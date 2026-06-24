'use client';

import { useState, useEffect } from 'react';

// Types pour notre dashboard
interface Player {
  name: string;
  ranking: number;
  is_seeded: boolean;
}

interface Match {
  id: number;
  tournament: string;
  surface: string;
  match_date: string;
  player1: Player;
  player2: Player;
  odds_home: number;
  odds_away: number;
}

interface Prediction {
  id: number;
  logic_type: string;
  is_valid: boolean;
  details: { reason: string };
  created_at: string;
  matches: Match;
}

export default function Dashboard() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLogic, setFilterLogic] = useState('ALL');
  const [activePrediction, setActivePrediction] = useState<Prediction | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  useEffect(() => {
    setLoading(true);
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';
    fetch(`${apiBase}/api/predictions?date=${selectedDate}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Erreur de chargement des prédictions');
        }
        return res.json();
      })
      .then((data) => {
        setPredictions(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Erreur de chargement des prédictions :", error);
        setPredictions([]);
        setLoading(false);
      });
  }, [selectedDate]);

  const filteredPredictions = predictions.filter(p => filterLogic === 'ALL' || p.logic_type === filterLogic);

  const formatDateLabel = (dateStr: string) => {
    try {
      const dateObj = new Date(`${dateStr}T12:00:00`);
      return dateObj.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950 -z-10" />
      
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="font-bold text-xl">T</span>
            </div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              TennisBet<span className="text-indigo-400">AI</span>
            </h1>
          </div>
          <button className="px-5 py-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all duration-300 font-medium text-sm">
            Exporter CSV
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-light mb-2">Analyses de Tennis</h2>
            <p className="text-slate-400">
              Prédictions pour le <span className="text-indigo-400 font-medium capitalize">{formatDateLabel(selectedDate)}</span>
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
            {/* Date Selector */}
            <div className="relative flex items-center bg-slate-900/50 rounded-xl border border-white/5 px-4 py-2 focus-within:border-indigo-500/40 backdrop-blur-sm transition-all duration-300">
              <span className="text-xs text-slate-400 mr-2 uppercase font-bold tracking-wider select-none">Date :</span>
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-white border-none focus:outline-none focus:ring-0 text-sm cursor-pointer [color-scheme:dark] font-medium"
              />
            </div>

            {/* Logics select */}
            <div className="flex gap-1 bg-slate-900/50 p-1.5 rounded-xl border border-white/5 backdrop-blur-sm">
              {['ALL', 'H1', 'H2', 'H3'].map(logic => (
                <button
                  key={logic}
                  onClick={() => setFilterLogic(logic)}
                  className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
                    filterLogic === logic 
                      ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/25' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {logic === 'ALL' ? 'Toutes' : `Logique ${logic}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredPredictions.map((pred) => (
              <div 
                key={pred.id} 
                className="group relative bg-slate-900/40 border border-white/5 rounded-2xl p-6 hover:bg-slate-900/80 hover:border-indigo-500/30 transition-all duration-500 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/0 to-purple-500/0 group-hover:from-indigo-500/5 group-hover:to-purple-500/5 transition-colors duration-500" />
                
                <div className="relative flex flex-col md:flex-row justify-between gap-8">
                  
                  {/* Left Side: Match Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold uppercase tracking-wider border border-indigo-500/20">
                        {pred.logic_type}
                      </span>
                      <span className="text-sm text-slate-500">{new Date(pred.matches.match_date).toLocaleDateString('fr-FR')} • {pred.matches.tournament} ({pred.matches.surface})</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-black/20 rounded-xl p-4 border border-white/5 flex justify-between items-center group-hover:border-white/10 transition-colors">
                        <div>
                          <div className="font-semibold text-lg flex items-center gap-2">
                            {pred.matches.player1.name}
                            {pred.matches.player1.is_seeded && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">TdS</span>}
                          </div>
                          <div className="text-slate-400 text-sm">Rank: #{pred.matches.player1.ranking}</div>
                        </div>
                        <div className="text-xl font-bold text-indigo-400">{pred.matches.odds_home}</div>
                      </div>
                      
                      <div className="bg-black/20 rounded-xl p-4 border border-white/5 flex justify-between items-center group-hover:border-white/10 transition-colors">
                        <div>
                          <div className="font-semibold text-lg flex items-center gap-2">
                            {pred.matches.player2.name}
                            {pred.matches.player2.is_seeded && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">TdS</span>}
                          </div>
                          <div className="text-slate-400 text-sm">Rank: #{pred.matches.player2.ranking}</div>
                        </div>
                        <div className="text-xl font-bold text-indigo-400">{pred.matches.odds_away}</div>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Details */}
                  <div className="md:w-72 flex flex-col justify-center border-t md:border-t-0 md:border-l border-white/10 pt-6 md:pt-0 md:pl-8">
                    <div className="text-sm text-slate-400 mb-2">Justification de l'IA</div>
                    <p className="text-sm text-slate-200 leading-relaxed">
                      {pred.details.reason}
                    </p>
                    <button 
                      onClick={() => setActivePrediction(pred)}
                      className="mt-4 text-indigo-400 text-sm font-medium hover:text-indigo-300 transition-colors flex items-center gap-1 group/btn cursor-pointer"
                    >
                      Voir l'analyse complète 
                      <span className="transform group-hover/btn:translate-x-1 transition-transform">→</span>
                    </button>
                  </div>

                </div>
              </div>
            ))}
            
            {filteredPredictions.length === 0 && (
              <div className="text-center py-20 text-slate-500 border border-dashed border-white/10 rounded-2xl">
                Aucune prédiction trouvée pour ce filtre.
              </div>
            )}
          </div>
        )}
      </main>

      {/* Complete Analysis Modal */}
      {activePrediction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all duration-300 animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-slate-900/95 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl shadow-indigo-500/10 overflow-y-auto max-h-[90vh]">
            {/* Close Button */}
            <button 
              onClick={() => setActivePrediction(null)}
              className="absolute top-6 right-6 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors duration-300 cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold uppercase tracking-wider border border-indigo-500/20">
                Logique {activePrediction.logic_type}
              </span>
              <span className="text-sm text-slate-400">
                {new Date(activePrediction.matches.match_date).toLocaleDateString('fr-FR')} • {activePrediction.matches.tournament}
              </span>
            </div>

            {/* Match Title */}
            <h3 className="text-2xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
              Analyse complète du Match
            </h3>

            {/* Players Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="bg-black/30 border border-white/5 rounded-2xl p-5">
                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Joueur 1 (Home)</div>
                <div className="font-bold text-lg flex items-center gap-2 text-white">
                  {activePrediction.matches.player1.name}
                  {activePrediction.matches.player1.is_seeded && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-medium">TdS</span>
                  )}
                </div>
                <div className="text-slate-400 text-sm mt-1">Classement : #{activePrediction.matches.player1.ranking}</div>
                <div className="text-xs text-indigo-400/80 font-semibold mt-3">Cote : {activePrediction.matches.odds_home}</div>
              </div>

              <div className="bg-black/30 border border-white/5 rounded-2xl p-5">
                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Joueur 2 (Away)</div>
                <div className="font-bold text-lg flex items-center gap-2 text-white">
                  {activePrediction.matches.player2.name}
                  {activePrediction.matches.player2.is_seeded && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-medium">TdS</span>
                  )}
                </div>
                <div className="text-slate-400 text-sm mt-1">Classement : #{activePrediction.matches.player2.ranking}</div>
                <div className="text-xs text-indigo-400/80 font-semibold mt-3">Cote : {activePrediction.matches.odds_away}</div>
              </div>
            </div>

            {/* Logic Rules Validation Checklist */}
            <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-6 mb-6">
              <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Critères de validation (Logique {activePrediction.logic_type})
              </h4>
              
              <ul className="space-y-3 text-sm">
                {activePrediction.logic_type === 'H1' && (
                  <>
                    <li className="flex items-start gap-3">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span className="text-slate-300">
                        <strong>Non têtes de série :</strong> Aucun des deux joueurs n'est tête de série (TdS).
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span className="text-slate-300">
                        <strong>Dernier match Undertaker :</strong> Les deux joueurs ont joué comme tocards dans leur dernier match.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span className="text-slate-300">
                        <strong>Break targets atteints :</strong> Toutes les conditions de breaks individuels et totaux ont été validées dans le match précédent.
                      </span>
                    </li>
                  </>
                )}
                
                {activePrediction.logic_type === 'H2' && (
                  <>
                    <li className="flex items-start gap-3">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span className="text-slate-300">
                        <strong>Têtes de série :</strong> Les deux joueurs sont classés comme têtes de série (TdS).
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span className="text-slate-300">
                        <strong>Dernier match Favori :</strong> Les deux joueurs ont joué comme favoris dans leur match précédent.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span className="text-slate-300">
                        <strong>Break targets manqués :</strong> Les conditions de breaks individuels et totaux n'ont PAS été atteintes lors de leur dernier match.
                      </span>
                    </li>
                  </>
                )}

                {activePrediction.logic_type === 'H3' && (
                  <>
                    <li className="flex items-start gap-3">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span className="text-slate-300">
                        <strong>Tête de série favori :</strong> Le joueur le mieux classé est tête de série (TdS).
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span className="text-slate-300">
                        <strong>Écart de classement :</strong> La différence de classement entre les deux joueurs est supérieure ou égale à 50 places. (Écart actuel : {Math.abs(activePrediction.matches.player1.ranking - activePrediction.matches.player2.ranking)} places).
                      </span>
                    </li>
                  </>
                )}
              </ul>
            </div>

            {/* Justification Text */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-slate-300 mb-2">Justification détaillée de l'IA</h4>
              <p className="text-sm text-slate-400 leading-relaxed bg-black/20 rounded-xl p-4 border border-white/5 whitespace-pre-line">
                {activePrediction.details.reason}
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-8">
              <button 
                onClick={() => setActivePrediction(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm transition-all duration-300 cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
