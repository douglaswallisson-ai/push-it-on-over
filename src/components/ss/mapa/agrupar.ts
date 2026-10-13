/**
 * Agrupamento dos veículos do CCO por região (pedido do CEO, 13/10/2026): no zoom do país, um grupo
 * por estado; no do estado, por cidade; no da cidade, por bairro (Florianópolis tem ~50 bairros);
 * bem de perto, os carros separados — mas os que estão quase no mesmo ponto (garagem) seguem juntos.
 * Cidade, estado e bairro vêm do endereço do rastreador (servidor, cco.py `local_do_endereco`).
 */

export type ItemMapa = {
  id: string | number;
  lat: number;
  lng: number;
  uf?: string | null;
  cidade?: string | null;
  bairro?: string | null;
};

export type Nivel = "estado" | "cidade" | "bairro" | "perto" | "solto";

/** Zoom a partir do qual cada nível vale. */
export function nivelDoZoom(z: number): Nivel {
  if (z < 7) return "estado";
  if (z < 10.5) return "cidade";
  if (z < 14) return "bairro";
  if (z < 16.5) return "perto";
  return "solto";
}

export type Grupo<T extends ItemMapa> = {
  chave: string;
  nome: string;
  nivel: Nivel;
  itens: T[];
  lat: number;
  lng: number;
};

/**
 * `projetar` converte lat/lng em pixels no zoom atual (map.project): usado para juntar quem está a
 * menos de `raioPx` quando não há região (endereço sem bairro) e no nível "perto".
 */
export function agrupar<T extends ItemMapa>(
  itens: T[],
  zoom: number,
  projetar: (lat: number, lng: number) => { x: number; y: number },
  raioPx = 46,
): Grupo<T>[] {
  const nivel = nivelDoZoom(zoom);
  const grupos = new Map<string, Grupo<T>>();
  for (const v of itens) {
    let chave: string;
    let nome: string;
    if (nivel === "solto") {
      chave = `v:${v.id}`;
      nome = "";
    } else if (nivel === "estado" && v.uf) {
      chave = `uf:${v.uf}`;
      nome = v.uf;
    } else if (nivel === "cidade" && v.cidade) {
      chave = `c:${v.cidade}|${v.uf ?? ""}`;
      nome = v.cidade;
    } else if (nivel === "bairro" && v.bairro) {
      chave = `b:${v.bairro}|${v.cidade ?? ""}`;
      nome = v.bairro;
    } else {
      const p = projetar(v.lat, v.lng);
      chave = `px:${Math.floor(p.x / raioPx)}:${Math.floor(p.y / raioPx)}`;
      nome = nivel === "perto" ? "" : (v.bairro ?? v.cidade ?? "");
    }
    const g = grupos.get(chave);
    if (g) g.itens.push(v);
    else grupos.set(chave, { chave, nome, nivel, itens: [v], lat: 0, lng: 0 });
  }
  for (const g of grupos.values()) {
    g.lat = g.itens.reduce((s, v) => s + v.lat, 0) / g.itens.length;
    g.lng = g.itens.reduce((s, v) => s + v.lng, 0) / g.itens.length;
  }
  return [...grupos.values()];
}
