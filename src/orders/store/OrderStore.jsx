import { createContext, useContext, useMemo, useReducer } from 'react';
import { PURCHASE_ORDERS } from '../orderMockData.js';
import {
  stageAfterConfirmation,
  stageAfterProposalDecision,
  CONFIRMATION_TYPE,
  PROPOSAL_STATUS,
} from '../orderRules.js';

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
  PROPOSAL_STATUS,
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_STATUS_TONE,
  lineStatusFor,
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

    case 'DECIDE_PROPOSAL':
      return {
        ...state,
        confirmations: {
          ...state.confirmations,
          [action.poId]: { ...state.confirmations[action.poId], proposal: action.proposal },
        },
        orders: state.orders.map((o) => (o.id === action.poId ? { ...o, stage: action.stage } : o)),
      };

    /*
     * Perhitungan sync tinggal di reducer, bukan di dalam aksi.
     *
     * Aksi dibuat sekali lewat `useMemo([])`, sehingga `state` yang tertangkap
     * closure-nya adalah state awal — membaca pesanan dari sana menghasilkan
     * data basi dan sync tidak mengubah apa pun. Reducer selalu menerima state
     * terkini, jadi di sinilah tempatnya.
     */
    case 'SYNC_PO': {
      const order = state.orders.find((o) => o.id === action.poId);
      const record = state.confirmations[action.poId];
      if (!order || !record?.lines?.length) return state;

      const lines = order.lines.map((line) => {
        const prop = record.lines.find((l) => l.no === line.no);
        if (!prop) return line;
        const quantity = Number(prop.proposedQty ?? line.quantity);
        const unitPrice = Number(prop.proposedPrice ?? line.unitPrice);
        return {
          ...line,
          quantity,
          unitPrice,
          amount: quantity * unitPrice,
          deliveryDate: prop.proposedDate
            ? new Date(prop.proposedDate).toISOString()
            : line.deliveryDate,
        };
      });

      const untaxedAmount = lines.reduce((sum, l) => sum + l.amount, 0);
      const taxes = Math.round(untaxedAmount * 0.11);

      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === action.poId
            ? {
                ...o,
                lines,
                untaxedAmount,
                taxes,
                amount: untaxedAmount + taxes,
                syncedAt: action.at,
                syncedBy: action.actor,
              }
            : o,
        ),
      };
    }

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
        const stage = stageAfterConfirmation(type, lines ?? []);

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
            // Usulan perubahan menunggu keputusan procurement; jenis lain
            // tidak punya tahap persetujuan sama sekali.
            proposal:
              type === CONFIRMATION_TYPE.PROPOSE_CHANGES
                ? { status: PROPOSAL_STATUS.PENDING }
                : null,
          },
        });
      },

      /**
       * Procurement menyetujui atau menolak usulan perubahan pemasok.
       *
       * Ditolak, PO kembali menunggu tanggapan pemasok (kartu New order).
       * Disetujui, PO menunggu pembaruan dari SAP — perubahan harganya baru
       * benar-benar berlaku setelah ditarik lewat tombol sync.
       */
      decideProposal(poId, approved, note, actor) {
        dispatch({
          type: 'DECIDE_PROPOSAL',
          poId,
          stage: stageAfterProposalDecision(approved),
          proposal: {
            status: approved ? PROPOSAL_STATUS.APPROVED : PROPOSAL_STATUS.REJECTED,
            note: note ?? '',
            decidedAt: now(),
            decidedBy: actor ?? '',
            synced: false,
          },
        });
      },

      /**
       * Menarik PO yang sudah diperbarui dari SAP.
       *
       * Hanya untuk satu PO, bukan seluruhnya: pembaruan massal akan menimpa
       * PO lain yang sedang ditanggapi pemasok. Tanpa backend, nilai usulan
       * pemasok yang disetujui diterapkan langsung ke barisnya — itulah yang
       * akan dikembalikan SAP setelah procurement memperbaruinya di sana.
       */
      syncFromSap(poId, actor) {
        dispatch({ type: 'SYNC_PO', poId, actor: actor ?? '', at: now() });
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
