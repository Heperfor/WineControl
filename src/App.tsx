/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AlmacenView } from './components/AlmacenView';
import { AnaliticasView } from './components/AnaliticasView';
import { AppccView } from './components/AppccView';
import { DashboardView } from './components/DashboardView';
import { ElaboracionView } from './components/ElaboracionView';
import { EmbotelladosView } from './components/EmbotelladosView';
import { EntradasUvaView } from './components/EntradasUvaView';
import { FoggaView } from './components/FoggaView';
import { InfoviView } from './components/InfoviView';
import { InsumosView } from './components/InsumosView';
import { LibrosAeatView } from './components/LibrosAeatView';
import { LibrosMedioRuralView } from './components/LibrosMedioRuralView';
import { Navbar } from './components/Navbar';
import { TabId } from './components/NavigationTabs';
import { OfficialDeadlinesToast } from './components/OfficialDeadlinesToast';
import { ParcelasView } from './components/ParcelasView';
import { PlanoBodegaView } from './components/PlanoBodegaView';
import { SalidasView } from './components/SalidasView';
import { TrazabilidadView } from './components/TrazabilidadView';
import { WineryProvider } from './context/WineryContext';
import { InfoviMesPeriodo } from './types/winery';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  // Deep link states
  const [targetLoteForTrace, setTargetLoteForTrace] = useState<string | undefined>();
  const [targetParcelaForTrace, setTargetParcelaForTrace] = useState<string | undefined>();
  const [targetParcelaForEntrada, setTargetParcelaForEntrada] = useState<string | undefined>();
  const [targetDepositoForEntrada, setTargetDepositoForEntrada] = useState<string | undefined>();
  const [targetDepositoForElab, setTargetDepositoForElab] = useState<string | undefined>();
  const [targetDepositoForEmb, setTargetDepositoForEmb] = useState<string | undefined>();
  const [targetDepositoForAnalitica, setTargetDepositoForAnalitica] = useState<string | undefined>();
  const [targetLoteForSalida, setTargetLoteForSalida] = useState<string | undefined>();
  const [targetAppccMonth, setTargetAppccMonth] = useState<string | undefined>();
  const [targetFoggaCampana, setTargetFoggaCampana] = useState<number | undefined>();
  const [targetInfoviPeriod, setTargetInfoviPeriod] = useState<
    { campanaInicio: number; mes: InfoviMesPeriodo } | undefined
  >();

  // Open modal flags
  const [openEntradaModal, setOpenEntradaModal] = useState(false);
  const [openElabModal, setOpenElabModal] = useState(false);
  const [openEmbModal, setOpenEmbModal] = useState(false);
  const [openSalidaModal, setOpenSalidaModal] = useState(false);
  const [isAlertsCollapsed, setIsAlertsCollapsed] = useState(false);

  // Navigation handlers
  const handleNavigateToTraceabilityLote = (lote: string) => {
    setTargetLoteForTrace(lote);
    setActiveTab('trazabilidad');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToTraceabilityParcela = (parcelaId: string) => {
    setTargetParcelaForTrace(parcelaId);
    setActiveTab('trazabilidad');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenNewEntradaForParcela = (parcelaId: string) => {
    setTargetDepositoForEntrada(undefined);
    setTargetParcelaForEntrada(parcelaId);
    setOpenEntradaModal(true);
    setActiveTab('entradas');
  };

  const handleOpenNewEntradaForDep = (depositoId: string) => {
    setTargetParcelaForEntrada(undefined);
    setTargetDepositoForEntrada(depositoId);
    setOpenEntradaModal(true);
    setActiveTab('entradas');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToElaboracionForDep = (depositoId: string) => {
    setTargetDepositoForElab(depositoId);
    setActiveTab('elaboracion');
  };

  const handleNavigateToSalidasForLote = (lote: string) => {
    setTargetLoteForSalida(lote);
    setOpenSalidaModal(true);
    setActiveTab('salidas');
  };

  return (
    <div className="min-h-screen bg-[#f8f6f2] text-stone-800 flex flex-col font-sans selection:bg-rose-900 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        isAlertsCollapsed={isAlertsCollapsed}
        onToggleAlerts={() => setIsAlertsCollapsed((prev) => !prev)}
        onBackHome={() => {
          setActiveTab('dashboard');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            onNavigateTab={(tab) => {
              setOpenEntradaModal(false);
              setOpenElabModal(false);
              setOpenEmbModal(false);
              setOpenSalidaModal(false);
              setTargetDepositoForAnalitica(undefined);
              setTargetAppccMonth(undefined);
              setTargetFoggaCampana(undefined);
              setTargetInfoviPeriod(undefined);
              setActiveTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {activeTab === 'parcelas' && (
          <ParcelasView
            onSelectParcelaForTraceability={handleNavigateToTraceabilityParcela}
            onOpenNewEntradaForParcela={handleOpenNewEntradaForParcela}
          />
        )}

        {activeTab === 'entradas' && (
          <EntradasUvaView
            initialOpenModal={openEntradaModal}
            preselectedParcelaId={targetParcelaForEntrada}
            preselectedDepositoId={targetDepositoForEntrada}
            onNavigateToElaboracion={handleNavigateToElaboracionForDep}
            onNavigateToAppcc={(fecha) => {
              setTargetAppccMonth(fecha ? fecha.slice(0, 7) : undefined);
              setActiveTab('appcc');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {activeTab === 'elaboracion' && (
          <ElaboracionView
            initialOpenModal={openElabModal}
            preselectedDepositoId={targetDepositoForElab}
          />
        )}

        {activeTab === 'embotellados' && (
          <EmbotelladosView
            initialOpenModal={openEmbModal}
            preselectedDepositoId={targetDepositoForEmb}
            onNavigateToTraceability={handleNavigateToTraceabilityLote}
            onNavigateToSalidas={handleNavigateToSalidasForLote}
          />
        )}

        {activeTab === 'almacen' && (
          <AlmacenView
            onOpenNewOperacionForDep={(depId) => {
              setTargetDepositoForElab(depId);
              setOpenElabModal(true);
              setActiveTab('elaboracion');
            }}
            onOpenNewEmbotelladoForDep={(depId) => {
              setTargetDepositoForEmb(depId);
              setOpenEmbModal(true);
              setActiveTab('embotellados');
            }}
          />
        )}

        {activeTab === 'plano' && (
          <PlanoBodegaView
            onOpenNewEntradaForDep={handleOpenNewEntradaForDep}
            onOpenNewOperacionForDep={(depId) => {
              setTargetDepositoForElab(depId);
              setOpenElabModal(true);
              setActiveTab('elaboracion');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenNewEmbotelladoForDep={(depId) => {
              setTargetDepositoForEmb(depId);
              setOpenEmbModal(true);
              setActiveTab('embotellados');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenAnaliticasForDep={(depId) => {
              setTargetDepositoForAnalitica(depId);
              setActiveTab('analiticas');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {activeTab === 'analiticas' && (
          <AnaliticasView preselectedDepositoId={targetDepositoForAnalitica} />
        )}

        {activeTab === 'salidas' && (
          <SalidasView
            initialOpenModal={openSalidaModal}
            preselectedLote={targetLoteForSalida}
            onNavigateToTraceability={handleNavigateToTraceabilityLote}
          />
        )}

        {activeTab === 'insumos' && <InsumosView />}

        {activeTab === 'trazabilidad' && (
          <TrazabilidadView
            initialLote={targetLoteForTrace}
            initialParcelaId={targetParcelaForTrace}
          />
        )}

        {activeTab === 'appcc' && <AppccView initialMonth={targetAppccMonth} />}

        {activeTab === 'libros_aeat' && <LibrosAeatView />}

        {activeTab === 'libros_medio_rural' && <LibrosMedioRuralView />}

        {activeTab === 'fogga_mr441b' && (
          <FoggaView initialCampanaInicio={targetFoggaCampana} />
        )}

        {activeTab === 'infovi' && (
          <InfoviView initialPeriod={targetInfoviPeriod} />
        )}
      </main>

      {/* Floating 3-week official deadline reminder */}
      <OfficialDeadlinesToast
        isCollapsed={isAlertsCollapsed}
        onSetCollapsed={setIsAlertsCollapsed}
        onOpenFogga={(campanaInicio) => {
          setTargetFoggaCampana(campanaInicio);
          setActiveTab('fogga_mr441b');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenInfovi={(campanaInicio, mes) => {
          setTargetInfoviPeriod({ campanaInicio, mes });
          setActiveTab('infovi');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Footer (desktop only so mobile keeps clean app viewport above bottom tab bar) */}
      <footer className="hidden lg:block bg-stone-900 border-t border-stone-800 text-stone-400 py-6 text-xs mt-12 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-serif-wine font-bold text-amber-200 text-sm">WINECONTROL</span>
            <span>·</span>
            <span>Adega Microparaxes</span>
          </div>
          <div className="text-stone-500">
            Conforme a normativa comunitaria vitivinícola y libros de registro oficiales • {new Date().getFullYear()}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <WineryProvider>
      <AppContent />
    </WineryProvider>
  );
}
