import { X, Phone, Save, Check, Sparkles, Shield, Send, ExternalLink, HelpCircle, Copy } from 'lucide-react';
import { ROOMMATES } from '../constants/roommates';
import { MoradorId, ChoresState, MetaWhatsAppConfig } from '../types';
import { updateRoommatePhone, updateMetaConfig, sendWhatsAppNotification } from '../services/choresService';

interface RoommatesPhonesModalProps {
  isOpen: boolean;
  onClose: () => void;
  chores: ChoresState;
  onSaveChores: (updated: ChoresState) => void;
}

export const RoommatesPhonesModal: React.FC<RoommatesPhonesModalProps> = ({
  isOpen,
  onClose,
  chores,
  onSaveChores,
}) => {
  const [activeTab, setActiveTab] = useState<'phones' | 'meta'>('phones');
  const [phones, setPhones] = useState<Record<MoradorId, string>>(chores.phones);
  const [metaConfig, setMetaConfig] = useState<MetaWhatsAppConfig>(chores.metaConfig);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<{ loading: boolean; message?: string; success?: boolean } | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  useEffect(() => {
    setPhones(chores.phones);
    setMetaConfig(chores.metaConfig);
  }, [chores]);

  if (!isOpen) return null;

  const handlePhoneChange = (id: MoradorId, val: string) => {
    setPhones((prev) => ({ ...prev, [id]: val }));
  };

  const handleSaveAll = async () => {
    let current = chores;
    for (const [id, num] of Object.entries(phones)) {
      current = await updateRoommatePhone(id as MoradorId, num);
    }
    current = await updateMetaConfig(metaConfig);
    onSaveChores(current);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleTestMetaApi = async () => {
    setTestStatus({ loading: true });
    // First save current config
    await updateMetaConfig(metaConfig);

    // Pick first available phone or user prompt
    const testPhone = phones.wellington || Object.values(phones).find((p) => p.trim() !== '') || '';
    if (!testPhone) {
      setTestStatus({
        loading: false,
        success: false,
        message: 'Preencha ao menos um número de telefone na aba "Telefones" para testar o envio.',
      });
      return;
    }

    const res = await sendWhatsAppNotification({
      toPhone: testPhone,
      messageText: '👋 *Gaiola 802*: Teste de conexão com a API da Meta WhatsApp realizado com sucesso!',
      taskType: 'trash',
      taskId: 'test',
      moradorId: 'wellington',
    });

    if (res.success) {
      setTestStatus({
        loading: false,
        success: true,
        message: `Mensagem enviada com sucesso para ${testPhone}! Verifique seu WhatsApp.`,
      });
    } else {
      setTestStatus({
        loading: false,
        success: false,
        message: res.error || 'Falha ao conectar com a API da Meta. Verifique o Token e o Phone Number ID.',
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 touch-none modal-backdrop-lock overscroll-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[92vh] sm:max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1B2A4A] text-[#FEF9C3] flex items-center justify-center shrink-0 shadow-xs">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Apê 802 · Notificações
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 leading-none mt-0.5">
                Moradores, Telefones & API Meta
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Fechar"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch: Telefones vs API Meta */}
        <div className="px-5 pt-3 pb-0 bg-white dark:bg-zinc-900 flex border-b border-zinc-100 dark:border-zinc-800 gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('phones')}
            className={`pb-2.5 transition-colors relative cursor-pointer ${
              activeTab === 'phones'
                ? 'text-[#1B2A4A] dark:text-zinc-100 border-b-2 border-[#1B2A4A] dark:border-zinc-100 font-bold'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            📱 Telefones dos Moradores (Quartos 1 a 5)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('meta')}
            className={`pb-2.5 transition-colors relative cursor-pointer ${
              activeTab === 'meta'
                ? 'text-[#1B2A4A] dark:text-zinc-100 border-b-2 border-[#1B2A4A] dark:border-zinc-100 font-bold'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            ⚙️ Configuração API da Meta (WhatsApp)
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden touch-pan-y modal-vertical-only overscroll-contain p-5 space-y-4 text-xs">
          {activeTab === 'phones' && (
            <div className="space-y-4">
              <p className="text-zinc-500 dark:text-zinc-400 text-xs">
                Cadastre o número de WhatsApp com DDD de cada morador. Esse número receberá as mensagens automáticas
                da <strong>Escala do Lixo</strong> (10h) e da <strong>Manutenção da Limpeza</strong> (Sexta-feira).
              </p>

              <div className="space-y-3">
                {ROOMMATES.map((m) => {
                  const val = phones[m.id] || '';
                  return (
                    <div
                      key={m.id}
                      className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-2xs"
                          style={{ backgroundColor: m.color.hex }}
                        >
                          {m.avatarInitials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-zinc-900 dark:text-zinc-100 text-xs truncate">
                            {m.name}
                          </div>
                          <div className="text-[11px] text-zinc-400">
                            {m.room} · {m.id === 'thaciane' ? 'Segunda' : m.id === 'pedro' ? 'Terça' : m.id === 'yan' ? 'Quarta' : m.id === 'wellington' ? 'Quinta' : 'Sexta'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-52">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-zinc-400 font-mono">
                            +55
                          </span>
                          <input
                            type="tel"
                            placeholder="(21) 99999-9999"
                            value={val.replace(/^55/, '')}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/[^\d]/g, '');
                              handlePhoneChange(m.id, digits ? `55${digits}` : '');
                            }}
                            className="w-full pl-10 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-[#1B2A4A]/30 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-300 text-[11px] flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Formato ideal:</strong> DDD + 9 dígitos (ex: 21999998888). O código do Brasil (+55) é adicionado automaticamente.
                </span>
              </div>
            </div>
          )}

          {activeTab === 'meta' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-300 text-xs">
                <div className="font-bold flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Meta WhatsApp Cloud API (Simple Psi / Gaiola 802)</span>
                </div>
                <p className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-300">
                  O <strong>Phone Number ID</strong> já está configurado como <strong>1261779623696198</strong> (remetente +55 21 96886-4184). Insira o seu <strong>Access Token</strong> abaixo para ativar o envio automático.
                </p>
              </div>

              {/* Webhook Box para Resposta por Botão Nativo */}
              <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 text-purple-900 dark:text-purple-300 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Webhook de Confirmação Automática (Botão Nativo)</span>
                </div>
                <p className="text-[11px] text-purple-800 dark:text-purple-300 leading-relaxed">
                  Para que o WhatsApp receba o clique no botão <em>"Confirmar retirada"</em> e marque como concluído no app sem link:
                </p>
                <div className="space-y-2 pt-1">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-400 block mb-0.5">
                      URL de Retorno de Chamada (Callback URL):
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value="https://gaiola-802.vercel.app/api/webhook/whatsapp"
                        className="flex-1 px-2.5 py-1 text-[11px] font-mono bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-800 rounded-lg text-zinc-900 dark:text-zinc-100 select-all"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard('https://gaiola-802.vercel.app/api/webhook/whatsapp', 'url')}
                        className="px-2 py-1 text-[11px] font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {copiedKey === 'url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'url' ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-400 block mb-0.5">
                      Token de Verificação (Verify Token):
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value="gaiola802_webhook_token"
                        className="flex-1 px-2.5 py-1 text-[11px] font-mono bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-800 rounded-lg text-zinc-900 dark:text-zinc-100 select-all"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard('gaiola802_webhook_token', 'token')}
                        className="px-2 py-1 text-[11px] font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {copiedKey === 'token' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'token' ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-purple-700 dark:text-purple-400 pt-1">
                  💡 No painel Meta for Developers &gt; WhatsApp &gt; Configuração &gt; Webhook, cole os dados acima e marque o campo <strong>messages</strong>.
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Phone Number ID (Identificação do Número de Telefone):
                  </label>
                  <input
                    type="text"
                    placeholder="1261779623696198"
                    value={metaConfig.phoneNumberId || '1261779623696198'}
                    onChange={(e) => setMetaConfig((prev) => ({ ...prev, phoneNumberId: e.target.value.trim() }))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-hidden focus:ring-2 focus:ring-[#1B2A4A]/30"
                  />
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">
                    ID correspondente ao número +55 21 96886-4184 na sua conta da Meta.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Access Token (Token de Acesso do Sistema / Permanente):
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Cole seu token de acesso EAAG..."
                    value={metaConfig.accessToken || ''}
                    onChange={(e) => setMetaConfig((prev) => ({ ...prev, accessToken: e.target.value.trim() }))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-hidden focus:ring-2 focus:ring-[#1B2A4A]/30"
                  />
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">
                    Token gerado no Meta for Developers (Temporário de 24h ou Permanente de Usuário do Sistema).
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-zinc-200/60 dark:border-zinc-800">
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Testar envio para seu WhatsApp:
                  </span>
                  <button
                    type="button"
                    onClick={handleTestMetaApi}
                    disabled={testStatus?.loading || !metaConfig.phoneNumberId || !metaConfig.accessToken}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 dark:bg-zinc-700 text-white hover:bg-zinc-900 text-xs font-semibold transition-colors disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{testStatus?.loading ? 'Enviando...' : 'Enviar Teste'}</span>
                  </button>
                </div>

                {testStatus && (
                  <div
                    className={`p-2.5 rounded-lg text-[11px] font-medium ${
                      testStatus.success
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    }`}
                  >
                    {testStatus.message}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/90 flex items-center justify-between gap-2 z-10">
          <div className="text-[11px] text-zinc-400">
            {savedSuccess && (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Salvo com sucesso!
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-[#1B2A4A] text-white hover:bg-[#15223c] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar Alterações</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
