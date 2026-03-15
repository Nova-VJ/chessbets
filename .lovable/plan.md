
Diagnóstico confirmado (para cortar el loop)
- Do I know what the issue is? Sí.
- El problema no es la partida de Simba ni el lobby: el fallo está en la capa de detección/conexión de wallet.
- Causa raíz combinada:
  1) `ConnectModal` detecta Binance con señales incompletas (no contempla `window.binancew3w.ethereum` ni discovery EIP-6963 completo).
  2) Toda la app usa `window.ethereum` directamente; con múltiples extensiones suele apuntar a otra wallet (ej. MetaMask), no a Binance.
  3) `useWallet` no es estado global compartido (cada uso crea estado propio), así que conectar en un componente no siempre se refleja en los demás.

Plan definitivo de implementación (sin tocar lobby/partidas)
1) Crear una capa única de “provider discovery” (robusta)
- Nuevo módulo utilitario para descubrir providers por todas las rutas:
  - `window.BinanceChain`
  - `window.binanceWallet`
  - `window.binancew3w?.ethereum`
  - `window.ethereum`
  - `window.ethereum.providers[]`
  - eventos EIP-6963 (`eip6963:announceProvider` + `eip6963:requestProvider`)
- Clasificar provider por wallet (`metamask`, `binance`, `trust`) usando flags + `rdns/name`.

2) Unificar estado wallet en un contexto global (single source of truth)
- Crear `WalletProvider` + `useWallet()` real compartido.
- Exponer API clara:
  - `getWalletStatus(walletType)` (instalada/no instalada)
  - `connectWallet(walletType)`
  - `activeProvider`, `activeWalletType`, `address`, `chainId`, `isBSC`, etc.
- Envolver `App` con `WalletProvider` por fuera de `AuthProvider` (porque Auth usa wallet).

3) Refactor de ConnectModal para usar solo la capa global
- Quitar detección directa con `window.*` dentro del modal.
- Binance/Trust/MetaMask deben usar el mismo flujo `connectWallet(walletType)`.
- Si Binance no aparece por permisos del navegador, mostrar mensaje accionable:
  - “Extensión detectada pero sin acceso al sitio”
  - botón con pasos rápidos (permitir acceso a este dominio).
- Mantener intacta la UI actual y el modo QR como fallback.

4) Enrutar TODA la lógica on-chain al provider activo (no a `window.ethereum`)
- Ajustar `contract.ts`, `tokens.ts`, `DepositModal` y puntos on-chain para crear `BrowserProvider(activeProvider)`.
- Así, si el usuario elige Binance, TODAS las transacciones salen por Binance (no MetaMask por accidente).

5) No romper Simba ni lobby (scope controlado)
- No modificar consultas ni lógica de `Lobby.tsx`, `lobby_games`, ni render de partidas.
- Cambios limitados a capa wallet/conexión/transacciones.

Detalles técnicos (implementación)
- Archivos principales a tocar:
  - `src/contexts/WalletContext.tsx` (nuevo)
  - `src/lib/walletProviders.ts` (nuevo)
  - `src/hooks/useWallet.ts` (adaptar a contexto global)
  - `src/components/ConnectModal.tsx`
  - `src/lib/contract.ts`
  - `src/lib/tokens.ts`
  - `src/components/DepositModal.tsx` (y cualquier uso directo de `window.ethereum`)
  - `src/App.tsx` (orden de providers)
- Compatibilidad:
  - Mantener firmas públicas existentes de `useWallet` para no romper componentes actuales.
  - Conectar y switch de red por provider activo.

Criterios de aceptación (definitivo)
1) Con Binance instalada y sesión abierta, el modal muestra “Instalada”.
2) Al pulsar Binance, solicita `eth_requestAccounts` y la app queda conectada con esa wallet.
3) Crear/join/cancel on-chain usa Binance (provider activo), no otra extensión.
4) Con MetaMask + Binance instaladas simultáneamente, se puede elegir una u otra sin conflicto.
5) La partida de Simba sigue visible en lobby y el flujo de unión no se altera.

Validación E2E que ejecutaré al implementar
- Caso A: solo Binance.
- Caso B: Binance + MetaMask.
- Caso C: Binance sin permisos de sitio (mensaje guiado correcto).
- Caso D: comprobar en `/lobby` que Simba sigue en “Partidas Disponibles”.
