import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Warehouse } from "lucide-react";
import { garagensQuery } from "@/lib/queries";
import { escopoGaragens } from "@/lib/escopo";
import { useSessao } from "@/hooks/use-sessao";

/**
 * Filtro de garagem das telas.
 *
 * Antes isso era um seletor global na barra lateral, junto do seletor de
 * organização. Ficou ruim por dois motivos: escondia no rodapé do menu um
 * filtro que muda o que a tela inteira mostra, e misturava visualmente duas
 * coisas de natureza diferente — organização é contexto de sessão, garagem é
 * recorte de consulta.
 *
 * Aqui ele vive onde o efeito acontece, ao lado dos demais filtros da tela.
 *
 * A lista já chega limitada pelo escopo do usuário: garagem fora do acesso não
 * aparece, nem desabilitada. O filtro é conveniência; a permissão continua
 * sendo aplicada na consulta.
 */
export function FiltroGaragem({
  valor,
  onChange,
  rotuloTodas = "Todas as garagens",
  className,
}: {
  valor: string;
  onChange: (id: string) => void;
  rotuloTodas?: string;
  className?: string;
}) {
  const { sessao } = useSessao();
  const { data } = useQuery(garagensQuery());

  const disponiveis = useMemo(() => {
    const todas = data ?? [];
    const escopo = escopoGaragens(sessao);
    return escopo === null ? todas : todas.filter((g) => escopo.includes(g.id));
  }, [data, sessao]);

  // Com uma garagem só não há o que escolher — o seletor vira ruído.
  if (disponiveis.length <= 1) return null;

  return (
    <label className={className ?? "inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3"}>
      <Warehouse className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Filtrar por garagem"
        className="cursor-pointer appearance-none bg-transparent pr-1 text-[13px] text-foreground outline-none"
      >
        <option value="">{rotuloTodas}</option>
        {disponiveis.map((g) => (
          <option key={g.id} value={g.id}>
            {g.nome}
          </option>
        ))}
      </select>
    </label>
  );
}
