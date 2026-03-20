# V3 critical integration fixes

## Scope
- Register missing frontend token detail route.
- Align frontend/backend health response contract.
- Fix broken score API paths.
- Unify WebSocket event envelope and add missing realtime broadcasts.
- Align notification config key usage and collector interval naming.
- Add baseline API-key protection for `/api/config/*`.
- Remove reported frontend `any` usages so lint passes.

## Files
- `v3/frontend/src/routes.tsx`
- `v3/frontend/src/pages/Dashboard.tsx`
- `v3/frontend/src/pages/TokenDetail.tsx`
- `v3/frontend/src/pages/OpportunityList.tsx`
- `v3/frontend/src/pages/config/SystemConfig.tsx`
- `v3/frontend/src/pages/config/KolConfig.tsx`
- `v3/frontend/src/pages/config/WalletConfig.tsx`
- `v3/frontend/src/pages/config/TelegramConfig.tsx`
- `v3/frontend/src/services/api.ts`
- `v3/frontend/src/services/types.ts`
- `v3/frontend/src/services/ws.ts`
- `v3/frontend/src/utils/errors.ts`
- `v3/backend/app/config.py`
- `v3/backend/app/main.py`
- `v3/backend/app/api/config_routes.py`
- `v3/backend/app/api/system_routes.py`
- `v3/backend/app/api/ws.py`
- `v3/backend/app/api/admin_auth.py`
- `v3/backend/app/infra/realtime.py`
- `v3/backend/app/collectors/base.py`
- `v3/backend/app/collectors/x_kol.py`
- `v3/backend/app/collectors/onchain_bsc.py`
- `v3/backend/app/collectors/onchain_solana.py`
- `v3/backend/app/analyzers/scoring_engine.py`

## Verification
- `npm run lint` in `v3/frontend`
- `npm run build` in `v3/frontend`
- `python -m pytest` in `v3/backend`
- `python -m compileall app` in `v3/backend`
