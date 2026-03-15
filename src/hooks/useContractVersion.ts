import { useState, useEffect } from 'react';
import { detectContractVersion, ContractVersion, CONTRACT_ADDRESS } from '@/lib/contract';

export const useContractVersion = () => {
  const [version, setVersion] = useState<ContractVersion>('unknown');
  const [checking, setChecking] = useState(true);

  const isDeployed = (CONTRACT_ADDRESS as string) !== '0x0000000000000000000000000000000000000000';

  useEffect(() => {
    if (!isDeployed || !window.ethereum) {
      setChecking(false);
      return;
    }

    detectContractVersion()
      .then(setVersion)
      .finally(() => setChecking(false));
  }, [isDeployed]);

  return {
    version,
    checking,
    isV2: version === 'v2',
    supportsUSDT: version === 'v2',
    isDeployed,
  };
};
