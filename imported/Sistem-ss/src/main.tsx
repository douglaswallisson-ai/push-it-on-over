import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import Login from "@/pages/Login";
import Inicio from "@/pages/Inicio";
import MapaAoVivo from "@/pages/MapaAoVivo";
import EmissaoCO2 from "@/pages/EmissaoCO2";
import Motoristas from "@/pages/Motoristas";
import MotoristaNovo from "@/pages/MotoristaNovo";
import Veiculos from "@/pages/Veiculos";
import VeiculoNovo from "@/pages/VeiculoNovo";
import AnaliseIndividual from "@/pages/AnaliseIndividual";
import AcompanhamentoMotorista from "@/pages/AcompanhamentoMotorista";
import DesempenhoFrota from "@/pages/DesempenhoFrota";
import Posicionamento from "@/pages/Posicionamento";
import MotorLigadoParado from "@/pages/MotorLigadoParado";
import Manutencao from "@/pages/Manutencao";
import CadastroAlarme from "@/pages/CadastroAlarme";
import Cerca from "@/pages/cadastros/Cerca";
import Combustivel from "@/pages/cadastros/Combustivel";
import Dispositivos from "@/pages/cadastros/Dispositivos";
import Grupos from "@/pages/cadastros/Grupos";
import Unidades from "@/pages/cadastros/Unidades";
import Usuarios from "@/pages/cadastros/Usuarios";
import Viagens from "@/pages/Viagens";
import CadastroViagem from "@/pages/CadastroViagem";
import LayoutAssentos from "@/pages/LayoutAssentos";
import Escala from "@/pages/Escala";
import Ponto from "@/pages/Ponto";
import Roteirizacao from "@/pages/Roteirizacao";
import ContagemPassageiros from "@/pages/ContagemPassageiros";
import Regeneracao from "@/pages/Regeneracao";
import Relatorios from "@/pages/Relatorios";
import Premiacao from "@/pages/Premiacao";
import IAFleetManager from "@/pages/IAFleetManager";
import Eventos from "@/pages/Eventos";
import EmBreve from "@/pages/EmBreve";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Inicio />} />
          <Route path="mapa" element={<MapaAoVivo />} />
          <Route path="co2" element={<EmissaoCO2 />} />
          <Route path="motoristas" element={<Motoristas />} />
          <Route path="motoristas/novo" element={<MotoristaNovo />} />
          <Route path="motoristas/perfil/:nome" element={<AcompanhamentoMotorista />} />
          <Route path="veiculos" element={<Veiculos />} />
          <Route path="veiculos/novo" element={<VeiculoNovo />} />
          <Route path="frota/analise" element={<AnaliseIndividual />} />
          <Route path="frota/posicionamento" element={<Posicionamento />} />
          <Route path="frota/motor-parado" element={<MotorLigadoParado />} />
          <Route path="frota/manutencao" element={<Manutencao />} />
          <Route path="frota/desempenho" element={<DesempenhoFrota />} />
          <Route path="cadastros/alarme" element={<CadastroAlarme />} />
          <Route path="cadastros/cerca" element={<Cerca />} />
          <Route path="cadastros/combustivel" element={<Combustivel />} />
          <Route path="cadastros/dispositivos" element={<Dispositivos />} />
          <Route path="cadastros/grupos" element={<Grupos />} />
          <Route path="cadastros/unidades" element={<Unidades />} />
          <Route path="cadastros/usuarios" element={<Usuarios />} />
          <Route path="fretamento/viagens" element={<Viagens />} />
          <Route path="fretamento/viagens/nova" element={<CadastroViagem />} />
          <Route path="fretamento/assentos" element={<LayoutAssentos />} />
          <Route path="fretamento/roteirizacao" element={<Roteirizacao />} />
          <Route path="fretamento/passageiros" element={<ContagemPassageiros />} />
          <Route path="fretamento/escala" element={<Escala />} />
          <Route path="fretamento/ponto" element={<Ponto />} />
          <Route path="frota/regeneracao" element={<Regeneracao />} />
          <Route path="relatorios" element={<Relatorios />} />
          <Route path="premiacao" element={<Premiacao />} />
          <Route path="eventos" element={<Eventos />} />
          <Route path="estrategico" element={<IAFleetManager />} />
          <Route path="*" element={<EmBreve />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
