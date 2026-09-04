import { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import { PATH, ROLE, STATUS } from '../lib/constants.js';
import { INTERNAL_USERS, SUBMISSIONS } from '../lib/mockData.js';
import { buildAccountId, buildInviteToken, buildTempPassword } from '../lib/format.js';

/**
 * Store tunggal untuk seluruh aplikasi. Tanpa backend: setiap aksi
 * memindahkan pengajuan antar status persis seperti yang digambarkan
 * pada dokumen flow, sehingga demo bisa menelusuri jalur dari ujung ke ujung.
 */

const AppStateContext = createContext(null);
const AppActionsContext = createContext(null);

const now = () => new Date().toISOString();

const initialState = {
  submissions: SUBMISSIONS,
  session: null, // { kind: 'internal' | 'supplier', user }
};

function patchSubmission(state, id, patch, timelineEntry) {
  return {
    ...state,
    submissions: state.submissions.map((s) => {
      if (s.id !== id) return s;
      const next = typeof patch === 'function' ? patch(s) : patch;
      return {
        ...s,
        ...next,
        timeline: timelineEntry ? [...s.timeline, timelineEntry] : s.timeline,
      };
    }),
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'SIGN_IN':
      return { ...state, session: action.session };

    case 'SIGN_OUT':
      return { ...state, session: null };

    case 'REGISTER_SUPPLIER':
      return { ...state, submissions: [action.submission, ...state.submissions] };

    case 'PATCH':
      return patchSubmission(state, action.id, action.patch, action.timelineEntry);

    default:
      return state;
  }
}

export function AppStoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const patch = useCallback((id, next, timelineEntry) => {
    dispatch({ type: 'PATCH', id, patch: next, timelineEntry });
  }, []);

  const actions = useMemo(() => {
    const entry = (label, actor) => ({ at: now(), label, actor });

    return {
      /* ---------------- Sesi ---------------- */
      signInInternal(email) {
        const user = INTERNAL_USERS.find(
          (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
        );
        if (!user) return { ok: false, message: 'Akun tidak ditemukan pada direktori Paragon.' };
        dispatch({ type: 'SIGN_IN', session: { kind: 'internal', user } });
        return { ok: true, user };
      },

      signInSupplier(accountId) {
        const target = accountId.trim().toLowerCase();
        const live = state.submissions.find(
          (s) => s.account?.accountId?.toLowerCase() === target,
        );
        if (!live) {
          return { ok: false, message: 'ID akun belum terdaftar atau undangan belum dikirim.' };
        }
        dispatch({
          type: 'SIGN_IN',
          session: {
            kind: 'supplier',
            user: { name: live.contact.name, email: live.contact.email },
            submissionId: live.id,
          },
        });
        return { ok: true, submission: live };
      },

      signOut() {
        dispatch({ type: 'SIGN_OUT' });
      },

      /* ---------------- Registrasi pemasok ---------------- */
      registerSupplier(payload) {
        const id = `SUP-2026-${String(150 + state.submissions.length).padStart(4, '0')}`;
        dispatch({
          type: 'REGISTER_SUPPLIER',
          submission: {
            id,
            status: STATUS.PENDING,
            submittedAt: now(),
            ...payload,
            onboardingPath: null,
            account: null,
            consent: null,
            verification: null,
            timeline: [entry('Registrasi dikirim pemasok', payload.contact.name)],
          },
        });
        return id;
      },

      /* ---------------- Keputusan staf ---------------- */
      approveSubmission(id, actor) {
        patch(
          id,
          { status: STATUS.APPROVED, decidedAt: now() },
          entry('Registrasi disetujui', actor.name),
        );
      },

      rejectSubmission(id, reason, actor) {
        patch(
          id,
          { status: STATUS.REJECTED, decidedAt: now(), rejectReason: reason },
          entry('Registrasi ditolak', actor.name),
        );
      },

      /* ---------------- Jalur A: undang pemasok ---------------- */
      inviteSupplier(id, actor) {
        const submission = state.submissions.find((s) => s.id === id);
        const account = {
          accountId: buildAccountId(submission.general.vendorType, id),
          temporaryPassword: buildTempPassword(),
          inviteToken: buildInviteToken(),
          emailSentAt: now(),
          passwordChanged: false,
        };
        patch(
          id,
          { status: STATUS.INVITED, onboardingPath: PATH.INVITE, account },
          entry('Undangan portal dikirim', actor.name),
        );
        return account;
      },

      /* ---------------- Jalur B: registrasi internal ---------------- */
      startInternalRegistration(id, documentSource, actor) {
        patch(
          id,
          {
            status: STATUS.INTERNAL_DRAFT,
            onboardingPath: PATH.INTERNAL,
            documentSource,
            internalDraft: { startedAt: now(), filledBy: actor.name },
          },
          entry('Jalur registrasi internal dipilih', actor.name),
        );
      },

      saveProfileSection(id, sectionId, values, filledBy) {
        patch(id, (s) => ({
          // Begitu pemasok menyentuh profilnya, status berpindah dari "diundang"
          // ke "melengkapi profil". Isian admin pada jalur internal tidak
          // mengubah status, karena masih menunggu approval manager.
          ...(filledBy === 'supplier' && [STATUS.INVITED, STATUS.CONNECTED].includes(s.status)
            ? { status: STATUS.ONBOARDING }
            : {}),
          profile: {
            ...s.profile,
            [sectionId]: values,
            completed: { ...s.profile.completed, [sectionId]: true },
            filledBy: { ...(s.profile.filledBy ?? {}), [sectionId]: filledBy },
          },
        }));
      },

      submitToManager(id, actor) {
        patch(
          id,
          (s) => ({
            status: STATUS.AWAITING_MANAGER,
            internalDraft: { ...s.internalDraft, completedAt: now() },
            managerReview: { status: 'pending' },
          }),
          entry('Profil diajukan ke manager', actor.name),
        );
      },

      managerApprove(id, actor) {
        const submission = state.submissions.find((s) => s.id === id);
        const account = {
          accountId: buildAccountId(submission.general.vendorType, id),
          temporaryPassword: buildTempPassword(),
          inviteToken: buildInviteToken(),
          emailSentAt: now(),
          passwordChanged: false,
        };
        patch(
          id,
          {
            status: STATUS.CONNECTED,
            account,
            managerReview: { status: 'approved', decidedAt: now(), decidedBy: actor.name },
            editRightsTransferredAt: now(),
          },
          entry('Manager menyetujui, akun dikirim ke pemasok', actor.name),
        );
        return account;
      },

      managerRequestRevision(id, note, actor) {
        patch(
          id,
          {
            status: STATUS.INTERNAL_DRAFT,
            managerReview: { status: 'revision_requested', note, decidedAt: now(), decidedBy: actor.name },
          },
          entry('Manager meminta revisi profil', actor.name),
        );
      },

      /* ---------------- Onboarding pemasok ---------------- */
      changePassword(id) {
        patch(id, (s) => ({
          status: STATUS.ONBOARDING,
          account: { ...s.account, passwordChanged: true, temporaryPassword: undefined },
        }));
      },

      acceptConsent(id, acceptedBy, version, path) {
        patch(
          id,
          {
            status: STATUS.AWAITING_VERIFICATION,
            consent: {
              gtcAcceptedAt: now(),
              dataAccuracyAcceptedAt: now(),
              acceptedBy,
              version,
              path,
            },
            verification: { status: 'pending', notes: [] },
          },
          entry('Persetujuan ditandatangani pemasok', acceptedBy),
        );
      },

      /* ---------------- Verifikasi dokumen ---------------- */
      verifyDocuments(id, actor) {
        patch(
          id,
          {
            status: STATUS.ACTIVE,
            activatedAt: now(),
            verification: { status: 'verified', verifiedAt: now(), verifiedBy: actor.name, notes: [] },
          },
          entry('Dokumen diverifikasi, akun aktif', actor.name),
        );
      },

      requestDocumentFix(id, notes, actor) {
        patch(
          id,
          {
            status: STATUS.NEEDS_DOCUMENT_FIX,
            verification: { status: 'revision_requested', requestedAt: now(), requestedBy: actor.name, notes },
          },
          entry('Perbaikan dokumen diminta', actor.name),
        );
      },

      resubmitDocuments(id, actor) {
        patch(
          id,
          { status: STATUS.AWAITING_VERIFICATION, verification: { status: 'pending', notes: [] } },
          entry('Dokumen diunggah ulang pemasok', actor),
        );
      },

      /* ---------------- Perubahan profil setelah aktif ---------------- */
      updateActiveProfile(id, sectionId, values, needsReverification, actor) {
        patch(
          id,
          (s) => ({
            profile: { ...s.profile, [sectionId]: values },
            ...(needsReverification
              ? {
                  status: STATUS.AWAITING_VERIFICATION,
                  verification: { status: 'pending', notes: [], triggeredBySection: sectionId },
                }
              : {}),
          }),
          entry(
            needsReverification
              ? `Perubahan ${sectionId} dikirim untuk verifikasi ulang`
              : `Perubahan ${sectionId} disimpan`,
            actor,
          ),
        );
      },

      resendInvite(id, actor) {
        patch(
          id,
          (s) => ({
            account: {
              ...s.account,
              temporaryPassword: buildTempPassword(),
              emailSentAt: now(),
              passwordChanged: false,
            },
          }),
          entry('Undangan dikirim ulang', actor.name),
        );
      },
    };
  }, [patch, state.submissions]);

  return (
    <AppStateContext.Provider value={state}>
      <AppActionsContext.Provider value={actions}>{children}</AppActionsContext.Provider>
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState harus dipakai di dalam AppStoreProvider.');
  return ctx;
}

export function useAppActions() {
  const ctx = useContext(AppActionsContext);
  if (!ctx) throw new Error('useAppActions harus dipakai di dalam AppStoreProvider.');
  return ctx;
}

export function useSession() {
  return useAppState().session;
}

export function useCurrentSubmission() {
  const { submissions, session } = useAppState();
  return submissions.find((s) => s.id === session?.submissionId) ?? null;
}

/** Hanya Staf Procurement Admin yang boleh membuka jalur registrasi internal. */
export function canUseInternalPath(user) {
  return user?.role === ROLE.ADMIN;
}

export function isManager(user) {
  return user?.role === ROLE.MANAGER;
}
