import { createContext, useContext, useMemo, useReducer } from 'react';
import { PURCHASE_ORDERS } from '../orderMockData.js';
import { stageAfterConfirmation } from '../orderRules.js';

/**
 * Store Order Collaboration.
 *
 * Purchase order sesungguhnya datang dari SAP dan konfirmasinya dikirim balik
 * ke sana. Proyek ini front-end saja, sehingga konfirmasi hanya mengubah
 * keadaan di memori — cukup untuk menelusuri alurnya, dan satu-satunya bagian
 * yang perlu diganti saat integrasi tersedia.
 *
 * Dipisah dari `AppStore` karena isinya tidak berkaitan dengan registrasi
 * pemasok: menggabungkannya hanya membuat kedua reducer sulit ditelusuri.
 */

const OrderStateContext = createContext(null);
const OrderActionsContext = createContext(null);

const now = () => new Date().toISOString();

// Aturan murni tinggal di orderRules.js agar dapat diuji tanpa React;
// diekspor ulang di sini supaya pemanggil cukup mengimpor dari satu tempat.
export {
  CONFIRMATION_TYPE,
  CONFIRMATION_LABEL,
  LINE_STATUS,
  LINE_STATUS_LABEL,
  LINE_STATUS_TONE,
  confirmationNumberFor,
} from '../orderRules.js';

const initialState = {
  orders: PURCHASE_ORDERS,
  /** poId → catatan konfirmasi. */
  confirmations: {},
};

function reducer(state, action) {
  switch (action.type) {
    case 'CONFIRM':
      return {
        ...state,
        confirmations: { ...state.confirmations, [action.poId]: action.record },
        orders: state.orders.map((order) =>
          order.id === action.poId ? { ...order, stage: action.stage } : order,
        ),
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

export function OrderStoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const actions = useMemo(
    () => ({
      /**
       * Mencatat konfirmasi pemasok atas sebuah PO.
       *
       * Tahapan PO ikut berpindah sesuai keputusannya, supaya kartu beranda
       * dan tabel daftar tidak perlu menghitung ulang artinya sendiri.
       */
      submitConfirmation(poId, { type, header, lines, reason }, actor) {
        const stage = stageAfterConfirmation(type);

        dispatch({
          type: 'CONFIRM',
          poId,
          stage,
          record: {
            type,
            header: header ?? {},
            lines: lines ?? [],
            reason: reason ?? '',
            submittedAt: now(),
            submittedBy: actor ?? '',
          },
        });
      },

      reset: () => dispatch({ type: 'RESET' }),
    }),
    [],
  );

  return (
    <OrderStateContext.Provider value={state}>
      <OrderActionsContext.Provider value={actions}>{children}</OrderActionsContext.Provider>
    </OrderStateContext.Provider>
  );
}

export function useOrderState() {
  const ctx = useContext(OrderStateContext);
  if (!ctx) throw new Error('useOrderState harus dipakai di dalam OrderStoreProvider');
  return ctx;
}

export function useOrderActions() {
  const ctx = useContext(OrderActionsContext);
  if (!ctx) throw new Error('useOrderActions harus dipakai di dalam OrderStoreProvider');
  return ctx;
}

/** PO milik satu pemasok, terbaca dari store (bukan dari data contoh mentah). */
export function ordersOfSupplier(state, supplierId) {
  return state.orders.filter((order) => order.supplierId === supplierId);
}

export function findOrder(state, poId) {
  return state.orders.find((order) => order.id === poId) ?? null;
}
