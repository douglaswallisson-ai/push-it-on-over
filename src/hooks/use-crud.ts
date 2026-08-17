import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, api } from "@/lib/api";
import { usandoMock } from "@/lib/modo";
import { acrescentar, registrarAuditoria } from "@/lib/session";

/**
 * CRUD contra a API, com queda para persistência local.
 *
 * As telas de cadastro gravavam em `sessionStorage` — o dado sumia ao fechar a
 * aba. Aqui elas passam a escrever de verdade, mas o modo de exemplo continua
 * funcionando: sem isso, demonstrar o sistema exigiria API no ar.
 *
 * A invalidação do cache é o ponto delicado. Depois de criar ou editar, a lista
 * precisa refletir a mudança; sem invalidar, o usuário salva e continua vendo o
 * estado anterior, conclui que não funcionou e salva de novo.
 */

type Recurso = "vehicles" | "drivers" | "devices" | "groups" | "subgroups" | "bus-lines";

/** Chave de cache correspondente a cada recurso, para invalidar após gravar. */
const CHAVE_CACHE: Record<Recurso, string[]> = {
  vehicles: ["veiculos"],
  drivers: ["motoristas"],
  devices: ["equipamentos"],
  groups: ["grupos"],
  subgroups: ["subgrupos"],
  "bus-lines": ["linhas"],
};

const ROTULO: Record<Recurso, string> = {
  vehicles: "Veículo",
  drivers: "Motorista",
  devices: "Dispositivo",
  groups: "Grupo",
  subgroups: "Subgrupo",
  "bus-lines": "Linha",
};

/**
 * Traduz o erro da API para algo acionável.
 *
 * "HTTP 409" não diz nada a quem está preenchendo um formulário; "já existe um
 * veículo com esta placa" diz.
 */
function mensagemDeErro(erro: unknown, recurso: Recurso): string {
  if (!(erro instanceof ApiError)) {
    return "Não foi possível salvar. Verifique sua conexão.";
  }
  const nome = ROTULO[recurso].toLowerCase();
  switch (erro.status) {
    case 400:
      return `Dados inválidos. Confira os campos obrigatórios.`;
    case 401:
      return "Sua sessão expirou. Entre novamente.";
    case 403:
      return `Você não tem permissão para alterar ${nome}.`;
    case 404:
      return `Este ${nome} não existe mais — pode ter sido excluído por outra pessoa.`;
    case 409:
      return `Já existe um ${nome} com esses dados.`;
    case 422:
      return "Algum campo está com formato inválido.";
    default:
      return erro.message || "Não foi possível salvar.";
  }
}

export function useCrud<T extends Record<string, unknown>>(recurso: Recurso) {
  const qc = useQueryClient();

  const invalidar = () => qc.invalidateQueries({ queryKey: CHAVE_CACHE[recurso] });

  const criar = useMutation({
    mutationFn: async (dados: Partial<T>) => {
      if (usandoMock()) {
        const local = { ...dados, id: `${recurso}-${Date.now()}` };
        acrescentar(recurso, local);
        return local as unknown as T;
      }
      return api.post<T>(`/api/v1/${recurso}/`, dados);
    },
    onSuccess: (criado) => {
      invalidar();
      registrarAuditoria("criacao", `${ROTULO[recurso]} criado.`);
      toast.success(`${ROTULO[recurso]} criado.`, {
        description: usandoMock() ? "Salvo localmente — sem API conectada." : undefined,
      });
      return criado;
    },
    onError: (e) => toast.error(mensagemDeErro(e, recurso)),
  });

  const editar = useMutation({
    mutationFn: async ({ id, dados }: { id: string | number; dados: Partial<T> }) => {
      if (usandoMock()) return { ...dados, id } as unknown as T;
      return api.put<T>(`/api/v1/${recurso}/${id}`, dados);
    },
    onSuccess: () => {
      invalidar();
      registrarAuditoria("edicao", `${ROTULO[recurso]} alterado.`);
      toast.success(`${ROTULO[recurso]} atualizado.`);
    },
    onError: (e) => toast.error(mensagemDeErro(e, recurso)),
  });

  const excluir = useMutation({
    mutationFn: async (id: string | number) => {
      if (usandoMock()) return;
      return api.del(`/api/v1/${recurso}/${id}`);
    },
    onSuccess: () => {
      invalidar();
      registrarAuditoria("exclusao", `${ROTULO[recurso]} excluído.`);
      toast.success(`${ROTULO[recurso]} excluído.`);
    },
    onError: (e) => toast.error(mensagemDeErro(e, recurso)),
  });

  return {
    criar,
    editar,
    excluir,
    /** true enquanto qualquer operação de escrita está em curso. */
    salvando: criar.isPending || editar.isPending || excluir.isPending,
  };
}
