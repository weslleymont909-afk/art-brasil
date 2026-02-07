
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { products as initialProducts } from './data';
import { Product, BudgetItem, ClientInfo } from './types';
import { generatePDF } from './services/pdfService';
import { 
  Plus, Minus, Trash, FileDown, Search, 
  ImageIcon, Settings, Upload, Refresh, X, Clipboard 
} from './components/Icons';

const LOCAL_STORAGE_KEY = 'art_brasil_products';

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : initialProducts;
  });

  const [view, setView] = useState<'catalog' | 'admin'>('catalog');
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    name: '',
    phone: '',
    date: new Date().toISOString().split('T')[0]
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(products));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return products.filter(p => 
      p.nome.toLowerCase().includes(lowerSearch)
    );
  }, [searchTerm, products]);

  const addItem = useCallback((product: Product) => {
    setBudgetItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.valor }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1, total: product.valor }];
    });
  }, []);

  const removeItem = useCallback((id: number) => {
    setBudgetItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id: number, delta: number) => {
    setBudgetItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty, total: newQty * item.valor };
      }
      return item;
    }));
  }, []);

  const totalBudget = budgetItems.reduce((acc, item) => acc + item.total, 0);

  const handleExportPDF = async () => {
    if (budgetItems.length === 0) {
      alert('Adicione pelo menos um item ao orçamento.');
      return;
    }
    setIsExporting(true);
    try {
      await generatePDF(budgetItems, clientInfo);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro ao gerar o PDF. Verifique sua conexão e os links das imagens.");
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleUpdateProduct = (id: number, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleDeleteProduct = (id: number) => {
    if (confirm('Deseja realmente excluir este produto do catálogo?')) {
      setProducts(prev => prev.filter(p => p.id !== id));
      setBudgetItems(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleAddProduct = () => {
    const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    const newProduct: Product = {
      id: newId,
      nome: 'Novo Produto',
      cm: '20',
      valor: 0,
      imagem: ''
    };
    setProducts(prev => [newProduct, ...prev]);
  };

  const handleResetData = () => {
    if (confirm('Isso apagará todas as suas alterações e voltará aos preços originais. Continuar?')) {
      setProducts(initialProducts);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  };

  // Função para baixar os dados como arquivo .json
  const downloadJSON = () => {
    const dataStr = JSON.stringify(products, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'banco_de_dados_artbrasil.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Função para carregar arquivo .json externo
  const importJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedData = JSON.parse(content);
        if (Array.isArray(importedData)) {
          setProducts(importedData);
          alert('Banco de dados importado com sucesso!');
        } else {
          alert('Formato de arquivo inválido.');
        }
      } catch (err) {
        alert('Erro ao ler o arquivo JSON.');
      }
    };
    reader.readAsText(file);
    // Limpar input para permitir re-upload do mesmo arquivo se necessário
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen pb-12 bg-slate-50 font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 py-4 px-4 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img 
              src="https://i.postimg.cc/dts7TZmg/ARTBRASIL.png" 
              alt="Logo" 
              className="h-10 w-auto object-contain cursor-pointer"
              onClick={() => setView('catalog')}
            />
            <div className="hidden md:block h-8 w-px bg-slate-200"></div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-tight">
                {view === 'admin' ? 'Gestão de Preços' : 'Catálogo Art Brasil'}
              </h1>
              <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest">Painel de Orçamentos</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <button 
              onClick={() => setView(view === 'catalog' ? 'admin' : 'catalog')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm ${
                view === 'admin' 
                ? 'bg-slate-800 text-white hover:bg-black' 
                : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-600 hover:text-indigo-600'
              }`}
             >
               {view === 'admin' ? <><X className="w-4 h-4"/> Sair do Admin</> : <><Settings className="w-4 h-4"/> Painel de Preços</>}
             </button>

             {view === 'catalog' && (
               <button 
                onClick={handleExportPDF}
                disabled={budgetItems.length === 0 || isExporting}
                className="flex items-center gap-2 font-bold py-2.5 px-6 rounded-xl shadow-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95"
              >
                <FileDown className="w-5 h-5" />
                {isExporting ? 'Processando...' : 'Exportar PDF'}
              </button>
             )}
          </div>
        </div>
      </header>

      {view === 'catalog' ? (
        <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                <Search className="w-5 h-5" />
              </span>
              <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Pesquisar imagem pelo nome..."
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-white shadow-sm text-lg outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map(product => (
                <div key={product.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all group flex flex-col">
                  <div className="aspect-[4/5] bg-slate-50 flex items-center justify-center relative overflow-hidden">
                    {product.imagem ? (
                      <img 
                        src={product.imagem} 
                        alt={product.nome} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=Imagem+Indisponível';
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-300">
                         <ImageIcon className="w-10 h-10" />
                         <span className="text-[10px] font-bold">SEM FOTO</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                       <button 
                          onClick={() => addItem(product)}
                          className="bg-white text-indigo-600 font-black py-3 px-6 rounded-xl shadow-2xl flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform"
                       >
                         <Plus className="w-5 h-5" /> ADICIONAR
                       </button>
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-bold text-slate-800 leading-tight mb-2 h-10 overflow-hidden line-clamp-2">{product.nome}</h3>
                    <div className="mt-auto flex items-end justify-between">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">TAMANHO</span>
                        <span className="text-sm font-bold text-slate-600">{product.cm} cm</span>
                      </div>
                      <span className="text-lg font-black text-indigo-600">{formatCurrency(product.valor)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="sticky top-28 space-y-6">
              <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-xs font-black mb-4 text-slate-400 uppercase tracking-widest">Dados para o PDF</h2>
                <div className="space-y-3">
                  <input 
                    type="text" 
                    value={clientInfo.name}
                    onChange={e => setClientInfo(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nome do Cliente"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                  />
                  <input 
                    type="text" 
                    value={clientInfo.phone}
                    onChange={e => setClientInfo(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="WhatsApp (ex: 91 98888-7777)"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                  />
                </div>
              </section>

              <section className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
                <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                  <h2 className="font-bold text-slate-700">Resumo do Pedido</h2>
                  <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-black">{budgetItems.length}</span>
                </div>
                <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-100">
                  {budgetItems.length === 0 ? (
                    <div className="py-12 px-8 text-center bg-slate-50/30">
                      <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Plus className="text-slate-300 w-6 h-6"/>
                      </div>
                      <p className="text-slate-400 text-sm italic">O orçamento está vazio.</p>
                    </div>
                  ) : (
                    budgetItems.map(item => (
                      <div key={item.id} className="p-4 flex items-center gap-3 hover:bg-indigo-50/20 transition-colors">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-800 text-xs truncate uppercase">{item.nome}</h4>
                          <p className="text-[10px] text-slate-400 font-bold">{item.cm} cm • {formatCurrency(item.valor)}</p>
                        </div>
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg shrink-0">
                          <button onClick={() => updateQuantity(item.id, -1)} className="p-1 rounded bg-white text-slate-500 shadow-sm hover:text-indigo-600"><Minus className="w-3 h-3"/></button>
                          <span className="text-xs font-black w-6 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="p-1 rounded bg-white text-slate-500 shadow-sm hover:text-indigo-600"><Plus className="w-3 h-3"/></button>
                        </div>
                        <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-500 p-1 shrink-0"><Trash className="w-4 h-4"/></button>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-6 bg-indigo-50/50 border-t border-slate-200 space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="text-slate-500 font-black uppercase text-[10px] tracking-widest pb-1">Subtotal</span>
                    <span className="text-3xl font-black text-indigo-700 tracking-tight">{formatCurrency(totalBudget)}</span>
                  </div>
                  <button 
                    onClick={handleExportPDF}
                    disabled={budgetItems.length === 0 || isExporting}
                    className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-95 transition-all disabled:bg-slate-200 disabled:shadow-none"
                  >
                    <FileDown className="w-6 h-6" /> {isExporting ? 'GERANDO PDF...' : 'CONCLUIR ORÇAMENTO'}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </main>
      ) : (
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-8 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
               <div>
                 <h2 className="text-2xl font-black text-slate-800 tracking-tight">Painel Administrativo</h2>
                 <p className="text-slate-500 text-sm mt-1">As alterações são salvas automaticamente no seu navegador.</p>
               </div>
               <div className="flex flex-wrap gap-3">
                 <input 
                    type="file" 
                    accept=".json" 
                    onChange={importJSON} 
                    ref={fileInputRef} 
                    className="hidden" 
                 />
                 <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-5 py-3 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm">
                   <Upload className="w-5 h-5" /> Importar Backup
                 </button>
                 <button onClick={downloadJSON} className="flex items-center gap-2 px-5 py-3 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm">
                   <FileDown className="w-5 h-5" /> Baixar Backup (JSON)
                 </button>
                 <button onClick={handleResetData} className="flex items-center gap-2 px-5 py-3 bg-white text-red-500 border border-red-100 rounded-xl font-bold hover:bg-red-50 transition-all">
                   <Refresh className="w-5 h-5" /> Resetar Banco
                 </button>
                 <button onClick={handleAddProduct} className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95">
                   <Plus className="w-5 h-5" /> Novo Produto
                 </button>
               </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-[0.2em] font-black border-b border-slate-100">
                    <th className="px-6 py-5">Foto</th>
                    <th className="px-6 py-5">Nome do Produto</th>
                    <th className="px-6 py-5">Link da Imagem (PostImg)</th>
                    <th className="px-6 py-5 text-center">CM</th>
                    <th className="px-6 py-5">Preço (R$)</th>
                    <th className="px-6 py-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {products.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200 shadow-sm">
                          {p.imagem ? (
                            <img src={p.imagem} className="w-full h-full object-cover" onError={(e) => (e.target as HTMLImageElement).src = 'https://via.placeholder.com/60?text=Err'} />
                          ) : (
                            <ImageIcon className="text-slate-300 w-5 h-5" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <input type="text" value={p.nome} onChange={(e) => handleUpdateProduct(p.id, { nome: e.target.value })} className="w-full font-bold text-slate-700 bg-transparent border-b border-transparent focus:border-indigo-400 outline-none px-1" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                          <input 
                            type="text" 
                            value={p.imagem || ''} 
                            placeholder="Link direto da imagem..." 
                            onChange={(e) => handleUpdateProduct(p.id, { imagem: e.target.value })} 
                            className="flex-1 text-[11px] text-indigo-500 bg-transparent outline-none font-mono" 
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <input type="text" value={p.cm} onChange={(e) => handleUpdateProduct(p.id, { cm: e.target.value })} className="w-12 text-center text-xs font-black text-slate-500 bg-slate-100 py-1.5 rounded-lg border-none" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                           <span className="text-xs font-bold text-slate-400">R$</span>
                           <input type="number" step="0.01" value={p.valor} onChange={(e) => handleUpdateProduct(p.id, { valor: parseFloat(e.target.value) || 0 })} className="w-24 bg-slate-100 font-black text-indigo-600 text-sm p-1.5 rounded-lg border-none focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDeleteProduct(p.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash className="w-5 h-5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {products.length === 0 && (
               <div className="p-20 text-center text-slate-400 italic">O catálogo está vazio. Comece adicionando um novo produto.</div>
            )}
          </div>
        </main>
      )}
    </div>
  );
};

export default App;
