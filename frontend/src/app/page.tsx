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

  useEffect(() => {
    setLoading(true);
    fetch('http://localhost:3001/api/predictions')
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
        setLoading(false);
      });
  }, []);

  const filteredPredictions = predictions.filter(p => filterLogic === 'ALL' || p.logic_type === filterLogic);

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
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-light mb-2">Analyses du Jour</h2>
            <p className="text-slate-400">Retrouvez les prédictions basées sur les logiques H1, H2 et H3.</p>
          </div>
          
          <div className="flex gap-2 bg-slate-900/50 p-1.5 rounded-xl border border-white/5 backdrop-blur-sm">
            {['ALL', 'H1', 'H2', 'H3'].map(logic => (
              <button
                key={logic}
                onClick={() => setFilterLogic(logic)}
                className={`px-6 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
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
                    <button className="mt-4 text-indigo-400 text-sm font-medium hover:text-indigo-300 transition-colors flex items-center gap-1 group/btn">
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
    </div>
  );
}
