import { useContractVersion } from '@/hooks/useContractVersion';
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

const ContractVersionBanner = () => {
  const { version, checking, isDeployed } = useContractVersion();

  if (!isDeployed || checking) return null;

  if (version === 'v1') {
    return (
      <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-sm text-yellow-300">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          <strong>Contrato V1 detectado</strong> — Solo soporta BNB. Para usar USDT, despliega ChessBetV2 y actualiza la dirección.
        </span>
      </div>
    );
  }

  if (version === 'v2') {
    return (
      <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
        <CheckCircle className="h-4 w-4 shrink-0" />
        <span><strong>ChessBetV2</strong> — BNB + USDT activos</span>
      </div>
    );
  }

  return null;
};

export default ContractVersionBanner;
