/**
 * Regressão linear (mínimos quadrados) para os gráficos de relação condução × relevo × consumo
 * (PM, 13/10/2026). Cada ponto pode ter peso (km rodados): um dia de 20 km não pesa igual a um de 800.
 */

export type Ponto = { x: number; y: number; w?: number };

export type Reta = {
  /** y = a + b·x */
  a: number;
  b: number;
  /** Quanto da variação de y a reta explica (0 a 1). */
  r2: number;
  n: number;
};

export function regressao(pontos: Ponto[]): Reta | null {
  const p = pontos.filter((q) => Number.isFinite(q.x) && Number.isFinite(q.y) && (q.w ?? 1) > 0);
  if (p.length < 3) return null;
  const sw = p.reduce((s, q) => s + (q.w ?? 1), 0);
  const mx = p.reduce((s, q) => s + (q.w ?? 1) * q.x, 0) / sw;
  const my = p.reduce((s, q) => s + (q.w ?? 1) * q.y, 0) / sw;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const q of p) {
    const w = q.w ?? 1;
    sxx += w * (q.x - mx) ** 2;
    sxy += w * (q.x - mx) * (q.y - my);
    syy += w * (q.y - my) ** 2;
  }
  if (sxx === 0) return null;
  const b = sxy / sxx;
  const a = my - b * mx;
  const r2 = syy === 0 ? 0 : (sxy * sxy) / (sxx * syy);
  return { a, b, r2, n: p.length };
}

export type Plano = { a: number; b1: number; b2: number; r2: number; n: number };

/** y = a + b1·x1 + b2·x2 (o efeito de cada um descontando o outro). */
export function regressao2(
  pontos: { x1: number; x2: number; y: number; w?: number }[],
): Plano | null {
  const p = pontos.filter((q) => [q.x1, q.x2, q.y].every(Number.isFinite) && (q.w ?? 1) > 0);
  if (p.length < 5) return null;
  // Equações normais 3×3 (com peso).
  const m = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  for (const q of p) {
    const w = q.w ?? 1;
    const v = [1, q.x1, q.x2];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) m[i][j] += w * v[i] * v[j];
      m[i][3] += w * v[i] * q.y;
    }
  }
  // Eliminação de Gauss.
  for (let c = 0; c < 3; c++) {
    let piv = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
    if (Math.abs(m[piv][c]) < 1e-12) return null;
    [m[c], m[piv]] = [m[piv], m[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const k = m[r][c] / m[c][c];
      for (let j = c; j < 4; j++) m[r][j] -= k * m[c][j];
    }
  }
  const [a, b1, b2] = [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
  const sw = p.reduce((s, q) => s + (q.w ?? 1), 0);
  const my = p.reduce((s, q) => s + (q.w ?? 1) * q.y, 0) / sw;
  let ssr = 0;
  let sst = 0;
  for (const q of p) {
    const w = q.w ?? 1;
    ssr += w * (q.y - (a + b1 * q.x1 + b2 * q.x2)) ** 2;
    sst += w * (q.y - my) ** 2;
  }
  return { a, b1, b2, r2: sst === 0 ? 0 : Math.max(0, 1 - ssr / sst), n: p.length };
}

/** Leitura simples da força da relação, para o gestor. */
export function forca(r2: number | null | undefined): string {
  if (r2 == null) return "—";
  if (r2 < 0.1) return "fraca";
  if (r2 < 0.3) return "moderada";
  if (r2 < 0.6) return "forte";
  return "muito forte";
}

/**
 * Tira a média de cada grupo (veículo): o que sobra é a variação do mesmo veículo de um dia para o
 * outro. Comparar veículos diferentes mistura modelo, carga e rota — com a CECOTI, entre veículos a
 * subida parecia melhorar o consumo; no mesmo caminhão, piora (análise de 13/10/2026).
 */
export function centrarPorGrupo<T extends { grupo: string | number; w?: number }>(
  pontos: T[],
  campos: (keyof T)[],
): T[] {
  const por = new Map<string | number, T[]>();
  for (const p of pontos) por.set(p.grupo, [...(por.get(p.grupo) ?? []), p]);
  const out: T[] = [];
  for (const lista of por.values()) {
    if (lista.length < 2) continue; // um dia só não tem variação dentro do veículo
    const sw = lista.reduce((s, p) => s + (p.w ?? 1), 0);
    const media = Object.fromEntries(
      campos.map((c) => [c, lista.reduce((s, p) => s + (p.w ?? 1) * (p[c] as number), 0) / sw]),
    );
    for (const p of lista)
      out.push({
        ...p,
        ...Object.fromEntries(campos.map((c) => [c, (p[c] as number) - media[c as string]])),
      });
  }
  return out;
}
