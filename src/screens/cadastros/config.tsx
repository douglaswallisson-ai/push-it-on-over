import type { ConfigCadastro } from "@/screens/cadastros/CadastroTela";
import { nomeDe } from "@/screens/cadastros/CadastroTela";

/**
 * Colunas e campos de cada cadastro. Campos e textos seguem o sistema atual
 * (vault: Telas/Unidades, Grupos, Dispositivos, Usuarios, Alarmes, Cerca, POI).
 */

const nf = (v: unknown, c = 0) => (v == null || v === "" ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: c }));
const sim = (v: unknown) => (v ? "Sim" : "Não");
const Cor = ({ c }: { c: unknown }) => <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-border" style={{ background: String(c || "#808080") }} />{String(c || "—")}</span>;

export const CFG_EMPRESA: ConfigCadastro = {
  tipo: "empresa", titulo: "Grupos", subtitulo: "Cadastros › Dados da empresa (grupo)", singular: "Grupo",
  explicacao: "Os dados do cliente. As bases e filiais dele (subgrupos) ficam em Cadastros › Unidades. Cliente novo só entra pelo cadastro de contrato (Console › Contratos › Novo contrato).",
  podeCriar: false, podeExcluir: false, rotulo: (r) => String(r.nome),
  colunas: [
    { chave: "nome", rotulo: "Nome" }, { chave: "razao_social", rotulo: "Razão social" }, { chave: "cnpj", rotulo: "CNPJ" },
    { chave: "velocidade_max", rotulo: "Velocidade máxima", num: true, render: (r) => `${nf(r.velocidade_max)} km/h` },
    { chave: "subgrupos", rotulo: "Unidades", num: true }, { chave: "veiculos", rotulo: "Veículos", num: true },
  ],
  secoes: [{ campos: [
    { nome: "logo", rotulo: "Logo do cliente (aparece no topo das telas)", tipo: "imagem", ajuda: "PNG, JPG, SVG ou WEBP de até 500 KB." },
    { nome: "nome", rotulo: "Nome do grupo", tipo: "texto", obrig: true, cheio: true },
    { nome: "razao_social", rotulo: "Razão social", tipo: "texto", cheio: true },
    { nome: "cnpj", rotulo: "CNPJ", tipo: "texto", placeholder: "99.999.999/9999-99" },
    { nome: "velocidade_max", rotulo: "Velocidade máxima (km/h)", tipo: "numero", obrig: true },
    { nome: "endereco", rotulo: "Endereço", tipo: "area" },
    { nome: "contatos", rotulo: "Contatos", tipo: "area" },
    { nome: "pro_rata", rotulo: "Pró rata", tipo: "toggle" },
    { nome: "codigo_cliente", rotulo: "Código do cliente", tipo: "texto" },
  ] }],
};

export const CFG_SUBGRUPO: ConfigCadastro = {
  tipo: "subgrupo", titulo: "Unidades", subtitulo: "Cadastros › Bases e filiais (subgrupos)", singular: "Unidade",
  explicacao: "Cada base ou filial do cliente. É o escopo de acesso dos usuários e o agrupamento de veículos e motoristas.",
  rotulo: (r) => String(r.nome), padrao: { cor: "#000000", tolerancia_antes: 5, tolerancia_depois: 5 },
  colunas: [
    { chave: "nome", rotulo: "Nome" }, { chave: "empresa", rotulo: "Empresa" }, { chave: "cnpj", rotulo: "CNPJ" },
    { chave: "cor", rotulo: "Cor", render: (r) => <Cor c={r.cor} /> },
    { chave: "tolerancia_antes", rotulo: "Tolerância antes / depois", render: (r) => `${nf(r.tolerancia_antes)} / ${nf(r.tolerancia_depois)} min` },
    { chave: "veiculos", rotulo: "Veículos", num: true },
  ],
  secoes: [{ campos: [
    { nome: "nome", rotulo: "Nome", tipo: "texto", obrig: true, cheio: true },
    { nome: "empresa", rotulo: "Empresa", tipo: "texto" }, { nome: "cnpj", rotulo: "CNPJ", tipo: "texto", placeholder: "99.999.999/9999-99" },
    { nome: "endereco", rotulo: "Endereço", tipo: "texto", cheio: true },
    { nome: "tolerancia_antes", rotulo: "Tolerância antes do início (min)", tipo: "numero" },
    { nome: "tolerancia_depois", rotulo: "Tolerância depois do início (min)", tipo: "numero" },
    { nome: "cor", rotulo: "Cor", tipo: "cor" }, { nome: "codigo_cliente", rotulo: "Código do cliente", tipo: "texto" },
  ] }],
};

export const CFG_GARAGEM: ConfigCadastro = {
  tipo: "garagem", titulo: "Garagens", subtitulo: "Cadastros › Pátios e garagens", singular: "Garagem",
  explicacao: "Pátios onde a frota pernoita. O sistema atual não tem este cadastro: ele existe só nesta plataforma.",
  rotulo: (r) => String(r.nome), padrao: { raio_m: 200 },
  colunas: [
    { chave: "nome", rotulo: "Nome" }, { chave: "subgroup_id", rotulo: "Unidade", render: (r, op) => nomeDe(op, "subgrupos", r.subgroup_id) ?? "—" },
    { chave: "endereco", rotulo: "Endereço" }, { chave: "capacidade", rotulo: "Vagas", num: true }, { chave: "responsavel", rotulo: "Responsável" },
  ],
  secoes: [{ campos: [
    { nome: "nome", rotulo: "Nome", tipo: "texto", obrig: true },
    { nome: "subgroup_id", rotulo: "Unidade", tipo: "select", opcoes: "subgrupos", obrig: true },
    { nome: "endereco", rotulo: "Endereço", tipo: "texto", cheio: true },
    { nome: "capacidade", rotulo: "Vagas", tipo: "numero" }, { nome: "responsavel", rotulo: "Responsável", tipo: "texto" },
    { nome: "mapa", rotulo: "Localização", tipo: "mapa" },
  ] }],
};

export const CFG_VEICULO: ConfigCadastro = {
  tipo: "veiculo", titulo: "Veículos", subtitulo: "Cadastros › Veículos da frota", singular: "Veículo",
  rotulo: (r) => [r.descricao, r.placa].filter(Boolean).join(" · "), motivoExclusao: "motivos_remocao",
  padrao: { velocidade_max: 90, fuso: -3, passageiros: 0, horario_verao: false },
  colunas: [
    { chave: "placa", rotulo: "Placa", render: (r) => <span className="font-mono font-semibold">{String(r.placa ?? "—")}</span> },
    { chave: "descricao", rotulo: "Descrição" }, { chave: "categoria", rotulo: "Categoria", render: (r, op) => String(r.categoria ?? nomeDe(op, "categorias", r.categoria_id) ?? "—") },
    { chave: "subgrupo", rotulo: "Unidade", render: (r, op) => String(r.subgrupo ?? nomeDe(op, "subgrupos", r.subgroup_id) ?? "—") },
    { chave: "modelo", rotulo: "Modelo" }, { chave: "velocidade_max", rotulo: "Vel. máx.", num: true, render: (r) => `${nf(r.velocidade_max)} km/h` },
    { chave: "media_consumo", rotulo: "Média (km/L)", num: true, render: (r) => (r.media_consumo ? String(r.media_consumo).replace(".", ",") : "—") },
  ],
  secoes: [
    { titulo: "Identificação", campos: [
      { nome: "placa", rotulo: "Placa", tipo: "texto", obrig: true, placeholder: "ABC-1D23" }, { nome: "carreta", rotulo: "Carreta", tipo: "texto" },
      { nome: "descricao", rotulo: "Descrição (prefixo)", tipo: "texto", cheio: true },
      { nome: "odometro_inicial_km", rotulo: "Odômetro inicial (km)", tipo: "numero" }, { nome: "horimetro_inicial", rotulo: "Horímetro inicial", tipo: "numero" },
    ] },
    { titulo: "Classificação", campos: [
      { nome: "tipo_id", rotulo: "Tipo", tipo: "select", opcoes: "tipos_veiculo" },
      { nome: "categoria_id", rotulo: "Categoria", tipo: "select", opcoes: "categorias", filtro: (o, v) => !v.tipo_id || Number(o.tipo_id) === Number(v.tipo_id) },
      { nome: "subgroup_id", rotulo: "Unidade (subgrupo)", tipo: "select", opcoes: "subgrupos", obrig: true },
      { nome: "velocidade_max", rotulo: "Velocidade máxima (km/h)", tipo: "numero" },
      { nome: "passageiros", rotulo: "Quantidade de passageiros", tipo: "numero" },
      { nome: "modelo", rotulo: "Modelo", tipo: "texto" }, { nome: "ano", rotulo: "Ano", tipo: "numero" },
    ] },
    { titulo: "Configurações operacionais", campos: [
      { nome: "condutor_id", rotulo: "Condutor fixo", tipo: "select", opcoes: "motoristas" },
      { nome: "fuso", rotulo: "Fuso horário", tipo: "select", opcoes: [{ id: -2, nome: "-2 (Noronha)" }, { id: -3, nome: "-3 (Brasília)" }, { id: -4, nome: "-4 (Amazonas)" }, { id: -5, nome: "-5 (Acre)" }] },
      { nome: "media_consumo", rotulo: "Média de consumo (km/L)", tipo: "numero", ajuda: "No sistema atual este campo não era gravado; aqui é." },
      { nome: "horario_verao", rotulo: "Ajusta horário de verão?", tipo: "toggle" },
      { nome: "observacoes", rotulo: "Observações", tipo: "area" },
    ] },
  ],
};

export const CFG_DISPOSITIVO: ConfigCadastro = {
  tipo: "dispositivo", titulo: "Dispositivos", subtitulo: "Cadastros › Rastreadores e câmeras", singular: "Dispositivo",
  rotulo: (r) => `${r.identificador} (${r.modelo ?? "—"})`, padrao: { tipo: "CAN" },
  colunas: [
    { chave: "identificador", rotulo: "Identificador", render: (r) => <span className="font-mono">{String(r.identificador)}</span> },
    { chave: "modelo", rotulo: "Modelo / fabricante", render: (r, op) => `${r.modelo ?? nomeDe(op, "modelos", r.modelo_id) ?? "—"} · ${r.fabricante ?? nomeDe(op, "fabricantes", r.fabricante_id) ?? "—"}` },
    { chave: "operadora", rotulo: "Operadora" }, { chave: "iccid", rotulo: "ICCID" }, { chave: "imei", rotulo: "IMEI" },
    { chave: "placa", rotulo: "Placa", render: (r) => <span className="font-mono">{String(r.placa ?? "—")}</span> },
    { chave: "produto_id", rotulo: "Produto", render: (r, op) => nomeDe(op, "produtos", r.produto_id) ?? "Sem produto" },
  ],
  secoes: [
    { titulo: "Dados", campos: [
      { nome: "identificador", rotulo: "Identificador", tipo: "texto", obrig: true, max: 50, ajuda: "Apenas letras e números." },
      { nome: "serial", rotulo: "Serial number", tipo: "texto" },
      { nome: "fabricante_id", rotulo: "Fabricante", tipo: "select", opcoes: "fabricantes", obrig: true },
      { nome: "modelo_id", rotulo: "Modelo", tipo: "select", opcoes: "modelos", obrig: true, filtro: (o, v) => !v.fabricante_id || Number(o.fabricante_id) === Number(v.fabricante_id) },
      { nome: "imei", rotulo: "IMEI", tipo: "texto", placeholder: "15 dígitos" }, { nome: "iccid", rotulo: "ICCID", tipo: "texto", max: 22 },
      { nome: "tipo", rotulo: "Tipo", tipo: "select", opcoes: [{ id: "ANALOGICO", nome: "Analógico" }, { id: "CAN", nome: "CAN" }] },
      { nome: "firmware", rotulo: "Versão de firmware", tipo: "texto", max: 30, visivel: (v) => Number(v.modelo_id) === 122, placeholder: "V1.8" },
      { nome: "operadora", rotulo: "Operadora", tipo: "select", opcoes: "operadoras" },
      { nome: "linha", rotulo: "Número da linha", tipo: "texto", placeholder: "(99) 99999-9999" },
    ] },
    { titulo: "Produto", campos: [{ nome: "produto_id", rotulo: "Produto", tipo: "select", opcoes: "produtos", obrig: true }] },
  ],
};

export const CFG_VINCULO: ConfigCadastro = {
  tipo: "vinculo", titulo: "Equipamentos por veículo", subtitulo: "Cadastros › Qual rastreador está em qual veículo", singular: "Vínculo",
  explicacao: "Um dispositivo só pode estar em um veículo. O primeiro de cada veículo é o primário.",
  rotulo: (r) => `${r.placa ?? r.unit_id} ↔ ${r.identificador ?? r.device_id}`, padrao: { primario: 1 },
  colunas: [
    { chave: "placa", rotulo: "Veículo", render: (r, op) => <span className="font-mono">{String(r.placa ?? nomeDe(op, "veiculos", r.unit_id) ?? "—")}</span> },
    { chave: "descricao", rotulo: "Descrição" },
    { chave: "identificador", rotulo: "Dispositivo", render: (r, op) => String(r.identificador ?? nomeDe(op, "dispositivos", r.device_id) ?? "—") },
    { chave: "modelo", rotulo: "Modelo" }, { chave: "primario", rotulo: "Primário", render: (r) => sim(Number(r.primario) === 1) },
    { chave: "desde", rotulo: "Desde", render: (r) => (r.desde ? new Date(String(r.desde)).toLocaleDateString("pt-BR") : "—") },
  ],
  secoes: [{ campos: [
    { nome: "unit_id", rotulo: "Veículo", tipo: "select", opcoes: "veiculos", obrig: true },
    { nome: "device_id", rotulo: "Dispositivo", tipo: "select", opcoes: "dispositivos", obrig: true },
    { nome: "primario", rotulo: "Dispositivo primário (GPRS)", tipo: "toggle" },
  ] }],
};

const PERFIS = [
  { id: "admin_empresa", nome: "Administrador da empresa" }, { id: "gestor", nome: "Gestor" },
  { id: "operador", nome: "Operador" }, { id: "consulta", nome: "Consulta" },
];
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"].map((n, i) => ({ id: i, nome: n }));

export const CFG_USUARIO: ConfigCadastro = {
  tipo: "usuario", titulo: "Usuários", subtitulo: "Cadastros › Quem acessa a plataforma", singular: "Usuário",
  explicacao: "A senha não é definida aqui: o sistema gera e envia por e-mail quando o cadastro for gravado no sistema atual.",
  rotulo: (r) => String(r.nome), padrao: { web: 1, mobile: 0, perfil: "consulta" },
  colunas: [
    { chave: "nome", rotulo: "Nome" }, { chave: "login", rotulo: "Login" }, { chave: "email", rotulo: "E-mail" },
    { chave: "perfil", rotulo: "Perfil", render: (r) => PERFIS.find((p) => p.id === r.perfil)?.nome ?? (Number(r.administrador) === 1 ? "Administrador" : "—") },
    { chave: "subgrupos", rotulo: "Unidades", num: true, render: (r) => String(((r.subgrupos as unknown[]) ?? []).filter(Boolean).length) },
    { chave: "acesso_ate", rotulo: "Acesso até", render: (r) => (r.acesso_ate ? new Date(`${String(r.acesso_ate).slice(0, 10)}T12:00`).toLocaleDateString("pt-BR") : "—") },
  ],
  secoes: [
    { titulo: "Dados", campos: [
      { nome: "nome", rotulo: "Nome", tipo: "texto", obrig: true, cheio: true },
      { nome: "login", rotulo: "Login", tipo: "texto", obrig: true }, { nome: "email", rotulo: "E-mail", tipo: "email", obrig: true },
      { nome: "perfil", rotulo: "Perfil de acesso", tipo: "select", opcoes: PERFIS, obrig: true },
      { nome: "web", rotulo: "Usuário web", tipo: "toggle" }, { nome: "mobile", rotulo: "Usuário mobile", tipo: "toggle" },
      { nome: "usuario_ss", rotulo: "Usuário SS", tipo: "toggle", somenteSS: true },
    ] },
    { titulo: "Restrições de acesso", campos: [
      { nome: "hora_inicio", rotulo: "De", tipo: "hora" }, { nome: "hora_fim", rotulo: "Até", tipo: "hora" },
      { nome: "dia_inicio", rotulo: "Dia inicial", tipo: "select", opcoes: DIAS }, { nome: "dia_fim", rotulo: "Dia final", tipo: "select", opcoes: DIAS },
      { nome: "acesso_ate", rotulo: "Data limite do acesso", tipo: "data" },
    ] },
    { titulo: "Acesso às unidades", campos: [{ nome: "subgrupos", rotulo: "Unidades que o usuário enxerga", tipo: "multi", opcoes: "subgrupos", obrig: true }] },
  ],
};

export const CFG_ALARME: ConfigCadastro = {
  tipo: "alarme", titulo: "Alarmes", subtitulo: "Cadastros › Regras de disparo e notificação", singular: "Alarme",
  rotulo: (r) => String(r.nome), padrao: { nivel: 1, notificar_monitor: true, notificar_email: true, regras: [{}] },
  colunas: [
    { chave: "nome", rotulo: "Nome" },
    { chave: "nivel", rotulo: "Nível", render: (r) => ({ 1: "Baixo", 2: "Médio", 3: "Alto" } as Record<number, string>)[Number(r.nivel)] ?? "—" },
    { chave: "regras", rotulo: "Regras", num: true, render: (r) => String(((r.regras as unknown[]) ?? []).length) },
    { chave: "veiculos", rotulo: "Veículos", num: true, render: (r) => String(((r.veiculos as unknown[]) ?? []).length) },
    { chave: "notificar_email", rotulo: "E-mail", render: (r) => sim(r.notificar_email) }, { chave: "notificar_monitor", rotulo: "Monitor", render: (r) => sim(r.notificar_monitor) },
  ],
  secoes: [
    { campos: [
      { nome: "nome", rotulo: "Nome do alarme", tipo: "texto", obrig: true, cheio: true },
      { nome: "subgroup_id", rotulo: "Unidade (opcional)", tipo: "select", opcoes: "subgrupos" },
      { nome: "nivel", rotulo: "Nível crítico", tipo: "select", opcoes: [{ id: 1, nome: "Baixo" }, { id: 2, nome: "Médio" }, { id: 3, nome: "Alto" }] },
      { nome: "regras", rotulo: "Regras", tipo: "regras" },
      { nome: "descricao", rotulo: "Descrição (procedimento em relação ao alarme)", tipo: "area", max: 250 },
    ] },
    { titulo: "Notificação", campos: [
      { nome: "notificar_monitor", rotulo: "Exibir no Monitor de Alarmes", tipo: "toggle" },
      { nome: "notificar_email", rotulo: "Enviar notificação por e-mail", tipo: "toggle" },
      { nome: "emails", rotulo: "E-mails (separe com \";\")", tipo: "texto", cheio: true, max: 500, visivel: (v) => Boolean(v.notificar_email) },
    ] },
    { titulo: "Unidades associadas", campos: [{ nome: "veiculos", rotulo: "Veículos que este alarme vigia", tipo: "multi", opcoes: "veiculos" }] },
  ],
};

export const CFG_CERCA: ConfigCadastro = {
  tipo: "cerca", titulo: "Cercas com alerta", subtitulo: "Cadastros › Cercas eletrônicas", singular: "Cerca",
  rotulo: (r) => String(r.nome), padrao: { tipo: 3, cor: "#808080", velocidade: 0, pontos: [] },
  colunas: [
    { chave: "nome", rotulo: "Cerca" }, { chave: "subgroup_id", rotulo: "Unidade", render: (r, op) => nomeDe(op, "subgrupos", r.subgroup_id) ?? "Todas" },
    { chave: "categoria", rotulo: "Categoria", render: (r, op) => String(r.categoria ?? nomeDe(op, "categorias_cerca", r.categoria_id) ?? "—") },
    { chave: "tipo", rotulo: "Área", render: (r) => ({ 1: "Circular", 2: "Quadrada", 3: "Poligonal", 4: "Vetor" } as Record<number, string>)[Number(r.tipo)] ?? "—" },
    { chave: "velocidade", rotulo: "Velocidade", num: true, render: (r) => (Number(r.velocidade) ? `${nf(r.velocidade)} km/h` : "—") },
    { chave: "cor", rotulo: "Cor", render: (r) => <Cor c={r.cor} /> },
  ],
  secoes: [{ campos: [
    { nome: "nome", rotulo: "Nome da cerca", tipo: "texto", obrig: true, cheio: true, ajuda: "Sem acentos nem caracteres especiais (regra do equipamento)." },
    { nome: "geometria", rotulo: "Desenho", tipo: "geometria" },
    { nome: "cor", rotulo: "Cor", tipo: "cor" }, { nome: "velocidade", rotulo: "Velocidade (0 a 300 km/h)", tipo: "numero" },
    { nome: "categoria_id", rotulo: "Categoria", tipo: "select", opcoes: "categorias_cerca", obrig: true },
    { nome: "subgroup_id", rotulo: "Unidade (opcional)", tipo: "select", opcoes: "subgrupos" },
    { nome: "descricao", rotulo: "Descrição", tipo: "area", max: 250 },
  ] }],
};

export const CFG_POI: ConfigCadastro = {
  tipo: "poi", titulo: "Pontos e cercas", subtitulo: "Cadastros › Pontos de interesse", singular: "Ponto",
  rotulo: (r) => String(r.nome), padrao: { raio_m: 50, cor: "#0B03FD" },
  colunas: [
    { chave: "nome", rotulo: "Local" }, { chave: "categoria", rotulo: "Categoria", render: (r, op) => String(r.categoria ?? nomeDe(op, "categorias_poi", r.categoria_id) ?? "—") },
    { chave: "raio_m", rotulo: "Raio", num: true, render: (r) => `${nf(r.raio_m)} m` },
    { chave: "latitude", rotulo: "Coordenadas", render: (r) => `${Number(r.latitude).toFixed(5)}, ${Number(r.longitude).toFixed(5)}` },
    { chave: "cor", rotulo: "Cor", render: (r) => <Cor c={r.cor} /> },
  ],
  secoes: [{ campos: [
    { nome: "nome", rotulo: "Nome do local", tipo: "texto", obrig: true, cheio: true, ajuda: "Sem aspas nem |." },
    { nome: "mapa", rotulo: "Localização", tipo: "mapa" },
    { nome: "categoria_id", rotulo: "Categoria", tipo: "select", opcoes: "categorias_poi", obrig: true },
    { nome: "cor", rotulo: "Cor", tipo: "cor" }, { nome: "icone", rotulo: "Ícone", tipo: "texto", placeholder: "fa-map-marker" },
    { nome: "descricao", rotulo: "Descrição", tipo: "area", max: 250 },
  ] }],
};

export const CFG_PONTO_PARADA: ConfigCadastro = {
  tipo: "ponto_parada", titulo: "Pontos de parada", subtitulo: "Cadastros › Paradas e pontos de controle das linhas", singular: "Ponto de parada",
  explicacao: "O ponto de controle (PC) é onde a viagem abre e fecha; é dele que saem os alarmes de abertura fora do PC.",
  rotulo: (r) => String(r.nome), padrao: { raio_m: 50, papel: "parada" },
  colunas: [
    { chave: "nome", rotulo: "Nome" }, { chave: "papel", rotulo: "Papel", render: (r) => (r.papel === "controle" ? "Ponto de controle" : "Parada") },
    { chave: "linhas", rotulo: "Linhas", render: (r) => ((r.linhas as string[]) ?? []).filter(Boolean).join(", ") || "—" },
    { chave: "raio_m", rotulo: "Raio", num: true, render: (r) => `${nf(r.raio_m)} m` },
  ],
  secoes: [{ campos: [
    { nome: "nome", rotulo: "Nome", tipo: "texto", obrig: true, cheio: true },
    { nome: "papel", rotulo: "Papel", tipo: "select", opcoes: [{ id: "parada", nome: "Ponto de parada" }, { id: "controle", nome: "Ponto de controle (PC)" }] },
    { nome: "mapa", rotulo: "Localização", tipo: "mapa" },
  ] }],
};

const horaCurta = (v: unknown) => (v ? String(v).slice(0, 5) : "—");
const dataBr = (v: unknown) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—");

/* ------------------------------------------------------------ fretamento */
// Campos e regras do sistema atual (plataforma_web: passengercontroller,
// costcentercontroller, routecontroller, linegroupcontroller, seat_layout).

export const CFG_PASSAGEIRO: ConfigCadastro = {
  tipo: "passageiro", titulo: "Cadastro de passageiros", subtitulo: "Fretamento › Passageiros transportados", singular: "Passageiro",
  explicacao: "Quem embarca nas viagens de fretamento. O cartão (RFID) é o que o validador lê no embarque.",
  rotulo: (r) => String(r.nome), padrao: { inativo: false },
  colunas: [
    { chave: "nome", rotulo: "Nome" }, { chave: "matricula", rotulo: "Matrícula" },
    { chave: "cartao", rotulo: "Cartão", render: (r) => <span className="font-mono">{String(r.cartao || "—")}</span> },
    { chave: "centro_custo", rotulo: "Centro de custo", render: (r, op) => String(r.centro_custo ?? nomeDe(op, "centros_custo", r.cost_center_id) ?? "—") },
    { chave: "turno_id", rotulo: "Turno", render: (r, op) => nomeDe(op, "turnos", r.turno_id) ?? "—" },
    { chave: "hora_inicio", rotulo: "Horário", render: (r) => (r.hora_inicio ? `${horaCurta(r.hora_inicio)} às ${horaCurta(r.hora_fim)}` : "—") },
    { chave: "viagens", rotulo: "Viagens", num: true },
    { chave: "inativo", rotulo: "Situação", render: (r) => (r.inativo ? `Inativo${r.inatividade_fim ? ` até ${dataBr(r.inatividade_fim)}` : ""}` : "Ativo") },
  ],
  secoes: [
    { titulo: "Identificação", campos: [
      { nome: "nome", rotulo: "Nome", tipo: "texto", obrig: true, cheio: true },
      { nome: "cpf", rotulo: "CPF", tipo: "texto", placeholder: "999.999.999-99" }, { nome: "matricula", rotulo: "Matrícula", tipo: "texto" },
      { nome: "cartao", rotulo: "Cartão (RFID)", tipo: "texto" }, { nome: "assento", rotulo: "Assento", tipo: "texto" },
    ] },
    { titulo: "Empresa e turno", campos: [
      { nome: "cost_center_id", rotulo: "Centro de custo", tipo: "select", opcoes: "centros_custo", obrig: true },
      { nome: "subgroup_id", rotulo: "Unidade", tipo: "select", opcoes: "subgrupos" },
      { nome: "empresa", rotulo: "Empresa", tipo: "texto" }, { nome: "gerencia", rotulo: "Gerência", tipo: "texto" },
      { nome: "gerencia_geral", rotulo: "Gerência geral", tipo: "texto" },
      { nome: "turno_id", rotulo: "Turno", tipo: "select", opcoes: "turnos" },
      { nome: "hora_inicio", rotulo: "Entrada", tipo: "hora" }, { nome: "hora_fim", rotulo: "Saída", tipo: "hora" },
    ] },
    { titulo: "Endereço", campos: [
      { nome: "rua", rotulo: "Rua", tipo: "texto", cheio: true }, { nome: "numero", rotulo: "Número", tipo: "texto" },
      { nome: "bairro", rotulo: "Bairro", tipo: "texto" }, { nome: "cidade", rotulo: "Cidade", tipo: "texto" },
      { nome: "cep", rotulo: "CEP", tipo: "texto", placeholder: "99999-999" },
    ] },
    { titulo: "Inatividade", campos: [
      { nome: "inativo", rotulo: "Passageiro inativo (férias, afastamento)", tipo: "toggle", cheio: true },
      { nome: "inatividade_inicio", rotulo: "Início", tipo: "data", visivel: (v) => Boolean(v.inativo) },
      { nome: "inatividade_fim", rotulo: "Fim", tipo: "data", visivel: (v) => Boolean(v.inativo) },
      { nome: "observacao", rotulo: "Observação", tipo: "area" },
    ] },
  ],
};

export const CFG_CENTRO_CUSTO: ConfigCadastro = {
  tipo: "centro_custo", titulo: "Centros de custo", subtitulo: "Fretamento › Contratantes e centros de custo", singular: "Centro de custo",
  explicacao: "Cada contratante (ou área dele) que paga o transporte. Passageiros, rotas e linhas ficam ligados a um centro de custo.",
  rotulo: (r) => String(r.nome),
  colunas: [
    { chave: "nome", rotulo: "Nome" }, { chave: "codigo_integracao", rotulo: "Código de integração" },
    { chave: "passageiros", rotulo: "Passageiros", num: true }, { chave: "linhas", rotulo: "Linhas", num: true },
  ],
  secoes: [{ campos: [
    { nome: "nome", rotulo: "Nome", tipo: "texto", obrig: true, cheio: true },
    { nome: "codigo_integracao", rotulo: "Código de integração", tipo: "numero" },
  ] }],
};

export const CFG_TURNO: ConfigCadastro = {
  tipo: "turno", titulo: "Turnos", subtitulo: "Fretamento › Turnos de trabalho dos passageiros", singular: "Turno",
  rotulo: (r) => String(r.nome),
  colunas: [{ chave: "nome", rotulo: "Turno" }, { chave: "passageiros", rotulo: "Passageiros", num: true }],
  secoes: [{ campos: [{ nome: "nome", rotulo: "Nome do turno", tipo: "texto", obrig: true, cheio: true, placeholder: "1º turno, ADM…" }] }],
};

export const CFG_GRUPO_LINHAS: ConfigCadastro = {
  tipo: "grupo_linhas", titulo: "Grupos de linhas", subtitulo: "Cadastros › Linhas agrupadas para filtros e relatórios", singular: "Grupo de linhas",
  rotulo: (r) => String(r.nome), padrao: { linhas: [] },
  colunas: [
    { chave: "nome", rotulo: "Grupo" },
    { chave: "linhas", rotulo: "Linhas", render: (r, op) => {
      const ids = (r.linhas as unknown[]) ?? [];
      const nomes = ids.map((i) => nomeDe(op, "linhas", i) ?? String(i));
      return nomes.length > 4 ? `${nomes.slice(0, 4).join(", ")} e mais ${nomes.length - 4}` : nomes.join(", ") || "—";
    } },
    { chave: "subgroup_id", rotulo: "Unidade", render: (r, op) => nomeDe(op, "subgrupos", r.subgroup_id) ?? "—" },
  ],
  secoes: [{ campos: [
    { nome: "nome", rotulo: "Nome do grupo", tipo: "texto", obrig: true },
    { nome: "subgroup_id", rotulo: "Unidade", tipo: "select", opcoes: "subgrupos" },
    { nome: "linhas", rotulo: "Linhas do grupo", tipo: "multi", opcoes: "linhas", obrig: true },
  ] }],
};

export const CFG_LAYOUT_ASSENTOS: ConfigCadastro = {
  tipo: "layout_assentos", titulo: "Layout de assentos", subtitulo: "Fretamento › Mapas de assentos dos veículos", singular: "Layout",
  explicacao: "Imagem com a numeração das poltronas, usada para marcar o assento de cada passageiro.",
  rotulo: (r) => String(r.nome), padrao: { assentos: 44 },
  colunas: [
    { chave: "nome", rotulo: "Layout" }, { chave: "assentos", rotulo: "Assentos", num: true }, { chave: "descricao", rotulo: "Descrição" },
    { chave: "cost_center_id", rotulo: "Centro de custo", render: (r, op) => nomeDe(op, "centros_custo", r.cost_center_id) ?? "Todos" },
  ],
  secoes: [{ campos: [
    { nome: "nome", rotulo: "Nome", tipo: "texto", obrig: true }, { nome: "assentos", rotulo: "Quantidade de assentos", tipo: "numero", obrig: true },
    { nome: "cost_center_id", rotulo: "Centro de custo", tipo: "select", opcoes: "centros_custo" },
    { nome: "descricao", rotulo: "Descrição", tipo: "texto", cheio: true },
    { nome: "imagem", rotulo: "Imagem do layout", tipo: "imagem", ajuda: "PNG ou JPG de até 500 KB." },
  ] }],
};

export const CFG_LINHA: ConfigCadastro = {
  tipo: "linha", titulo: "Linhas", subtitulo: "Cadastros › Linhas e itinerários", singular: "Linha",
  rotulo: (r) => `${r.nome}${r.descricao ? ` · ${r.descricao}` : ""}`, padrao: { circular: false, pontos: [] },
  colunas: [
    { chave: "nome", rotulo: "Linha" }, { chave: "descricao", rotulo: "Descrição" },
    { chave: "subgrupo", rotulo: "Unidade", render: (r, op) => String(r.subgrupo ?? nomeDe(op, "subgrupos", r.subgroup_id) ?? "—") },
    { chave: "modalidade_id", rotulo: "Modalidade", render: (r, op) => nomeDe(op, "modalidades_linha", r.modalidade_id) ?? "—" },
    { chave: "km", rotulo: "Extensão", num: true, render: (r) => (Number(r.km) ? `${nf(r.km, 1)} km` : "—") },
    { chave: "duracao_min", rotulo: "Duração", num: true, render: (r) => (Number(r.duracao_min) ? `${nf(r.duracao_min)} min` : "—") },
    { chave: "circular", rotulo: "Circular", render: (r) => sim(r.circular) },
  ],
  secoes: [{ campos: [
    { nome: "nome", rotulo: "Nome da linha", tipo: "texto", obrig: true }, { nome: "descricao", rotulo: "Descrição", tipo: "texto" },
    { nome: "subgroup_id", rotulo: "Unidade", tipo: "select", opcoes: "subgrupos" },
    { nome: "modalidade_id", rotulo: "Modalidade", tipo: "select", opcoes: "modalidades_linha" },
    { nome: "km", rotulo: "Extensão (km)", tipo: "numero" }, { nome: "duracao_min", rotulo: "Duração (min)", tipo: "numero" },
    { nome: "circular", rotulo: "Linha circular", tipo: "toggle" },
    { nome: "pontos", rotulo: "Itinerário", tipo: "pontos" },
  ] }],
};
