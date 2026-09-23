import { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import {
  ACCOUNT_STATUS,
  PATH,
  ROLE,
  SAP_STATUS,
  SOURCING_METHOD,
  STATUS,
  TENDER_OUTCOME,
} from '../lib/constants.js';
import { INTERNAL_USERS, SUBMISSIONS } from '../lib/mockData.js';
// Aturan murni tinggal di lib/; diekspor ulang agar jalur impor lama tetap jalan.
export { findTaxIdDuplicate } from '../lib/taxIdentity.js';
import { buildAccountId, buildInviteToken, buildTempPassword } from '../lib/format.js';
import { VENDOR_TYPES, labelOf } from '../lib/masterData.js';

/**
 * Store tunggal untuk seluruh aplikasi. Tanpa backend: setiap aksi
 * memindahkan pengajuan antar status persis seperti yang digambarkan
 * pada dokumen flow, sehingga demo bisa menelusuri jalur dari ujung ke ujung.
 */

const AppStateContext = createContext(null);
const AppActionsContext = createContext(null);

const now = () => new Date().toISOString();

/**
 * Setiap pengajuan memperoleh tiga bidang operasional yang tidak ada pada data
 * contoh: status akun (active/blocked, didorong dari SAP), keadaan pengiriman
 * ke SAP, dan riwayat pengirimannya. Dinormalisasi di satu tempat supaya
 * seluruh layar dapat membacanya tanpa pemeriksaan `?.` berulang.
 */
const withOperationalFields = (submission) => ({
  accountStatus: ACCOUNT_STATUS.ACTIVE,
  accountStatusReason: null,
  accountStatusAt: null,
  sap: { status: SAP_STATUS.NOT_SUBMITTED, history: [] },
  ...submission,
});

const initialState = {
  submissions: SUBMISSIONS.map(withOperationalFields),
  qualifications: {}, // supplierId → { lines, header, status, updatedAt, updatedBy }
  /** Log pengiriman ke SAP yang gagal — dibaca tim Master Data Management. */
  sapLogs: [],
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

    case 'SAVE_QUALIFICATION':
      return {
        ...state,
        qualifications: { ...state.qualifications, [action.supplierId]: action.qualification },
      };

    case 'UPDATE_SESSION_USER':
      return {
        ...state,
        session: { ...state.session, user: { ...state.session.user, ...action.patch } },
      };

    case 'SAP_LOG':
      return { ...state, sapLogs: [action.log, ...state.sapLogs] };

    case 'RESOLVE_SAP_LOG':
      return {
        ...state,
        sapLogs: state.sapLogs.map((log) =>
          log.id === action.logId
            ? { ...log, resolvedAt: now(), resolvedBy: action.actor, resolution: action.resolution }
            : log,
        ),
      };

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
        // Blokir didorong dari SAP, bukan ditetapkan di aplikasi ini. Pemasok
        // yang diblokir ditahan di layar masuk, bukan dibiarkan masuk lalu
        // dibatasi per halaman — satu gerbang lebih sulit terlewat.
        if (live.accountStatus === ACCOUNT_STATUS.BLOCKED) {
          return {
            ok: false,
            blocked: true,
            message:
              live.accountStatusReason
                ? `Akun diblokir: ${live.accountStatusReason} Hubungi tim procurement Paragon.`
                : 'Akun Anda diblokir. Hubungi tim procurement Paragon.',
          };
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
            status: STATUS.SUPPLIER_REQUEST,
            submittedAt: now(),
            ...payload,
            onboardingPath: null,
            accountStatus: ACCOUNT_STATUS.ACTIVE,
            accountStatusReason: null,
            accountStatusAt: null,
            sap: { status: SAP_STATUS.NOT_SUBMITTED, history: [] },
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
          accountId: buildAccountId(labelOf(VENDOR_TYPES, submission.general.vendorType), id),
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

      /** Menyunting salah satu bagian data pendaftaran (general/address/contact). */
      updateRegistrationSection(id, sectionId, values, actor) {
        patch(
          id,
          { [sectionId]: values },
          entry(`Data pendaftaran diperbarui (${sectionId})`, actor),
        );
      },

      /**
       * Menyelesaikan registrasi internal. Sejak persyaratan diubah, tahap ini
       * tidak lagi melewati persetujuan manager: begitu staf merampungkan profil,
       * akun pemasok langsung dibuat dan undangannya dikirim.
       */
      finishInternalRegistration(id, actor) {
        const submission = state.submissions.find((s) => s.id === id);
        const account = {
          accountId: buildAccountId(labelOf(VENDOR_TYPES, submission.general.vendorType), id),
          temporaryPassword: buildTempPassword(),
          inviteToken: buildInviteToken(),
          emailSentAt: now(),
          passwordChanged: false,
        };
        patch(
          id,
          (s) => ({
            status: STATUS.CONNECTED,
            account,
            internalDraft: { ...s.internalDraft, completedAt: now() },
            editRightsTransferredAt: now(),
          }),
          entry('Registrasi internal selesai, akun dikirim ke pemasok', actor.name),
        );
        return account;
      },

      /* ---------------- Preferred supplier ---------------- */

      /** Mengajukan pemasok ke manager untuk dinilai sebagai preferred supplier. */
      submitForPreferred(id, actor) {
        patch(
          id,
          { status: STATUS.AWAITING_PREFERRED, preferredSubmittedAt: now(), preferredSubmittedBy: actor.name },
          entry('Diajukan sebagai preferred supplier', actor.name),
        );
      },

      approvePreferred(id, note, actor) {
        patch(
          id,
          {
            status: STATUS.PREFERRED,
            preferredDecision: { decision: 'approved', note, decidedAt: now(), decidedBy: actor.name },
          },
          entry('Ditetapkan sebagai preferred supplier', actor.name),
        );
      },

      disqualifySupplier(id, reason, actor) {
        patch(
          id,
          {
            status: STATUS.DISQUALIFIED,
            preferredDecision: { decision: 'disqualified', note: reason, decidedAt: now(), decidedBy: actor.name },
          },
          entry('Pemasok didiskualifikasi', actor.name),
        );
      },

      /** Mengembalikan pemasok yang didiskualifikasi ke tahap qualification. */
      reopenQualification(id, actor) {
        patch(
          id,
          { status: STATUS.QUALIFICATION, preferredDecision: null },
          entry('Dikembalikan ke tahap qualification', actor.name),
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
            status: STATUS.REGISTRATION,
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
      /**
       * Dokumen lolos periksa. Pemasok TIDAK langsung masuk tahap qualification:
       * ia menunggu seluruh kuesioner yang ditugaskan divalidasi peninjau.
       * Gerbang kedua itu dijalankan `advanceToQualification` di bawah.
       */
      verifyDocuments(id, actor) {
        patch(
          id,
          {
            status: STATUS.AWAITING_QUESTIONNAIRE,
            registeredAt: now(),
            verification: { status: 'verified', verifiedAt: now(), verifiedBy: actor.name, notes: [] },
          },
          entry('Dokumen lolos periksa, menunggu validasi kuesioner', actor.name),
        );
      },

      /**
       * Kuesioner terakhir yang ditugaskan sudah disetujui peninjau.
       *
       * Pemasok TIDAK langsung masuk qualification: profil dan kuesionernya
       * masih harus disetujui manager procurement lebih dulu. Verifikasi
       * dokumen dan tinjauan kuesioner dikerjakan staf; gerbang ini adalah
       * tempat manager menilai keduanya sekaligus sebelum pemasok dikualifikasi.
       *
       * Aman dipanggil berulang: status selain AWAITING_QUESTIONNAIRE diabaikan.
       */
      advanceToQualification(id, actor) {
        const submission = state.submissions.find((s) => s.id === id);
        if (submission?.status !== STATUS.AWAITING_QUESTIONNAIRE) return false;
        patch(
          id,
          { status: STATUS.AWAITING_MANAGER_REVIEW, questionnaireValidatedAt: now() },
          entry(
            'Kuesioner tervalidasi, menunggu persetujuan manager procurement',
            actor?.name ?? 'Sistem',
          ),
        );
        return true;
      },

      /**
       * Manager procurement menyetujui profil dan kuesioner sekaligus.
       * Inilah satu-satunya jalan masuk ke tahap qualification.
       */
      approveProfileAndQuestionnaire(id, note, actor) {
        patch(
          id,
          {
            status: STATUS.QUALIFICATION,
            qualificationOpenedAt: now(),
            managementReview: {
              decision: 'approved',
              note: note ?? '',
              decidedAt: now(),
              decidedBy: actor?.name ?? '',
            },
          },
          entry('Profil dan kuesioner disetujui manager, lanjut ke qualification', actor?.name ?? ''),
        );
      },

      /**
       * Manager mengembalikan pemasok untuk diperbaiki.
       *
       * Dikembalikan ke `NEEDS_DOCUMENT_FIX` — bukan ke status menunggu
       * sebelumnya — karena yang perlu terjadi berikutnya adalah pemasok
       * memperbaiki datanya, dan status itulah yang sudah membuka jalur
       * perbaikan beserta catatan per fieldnya.
       */
      returnForRevision(id, note, actor) {
        patch(
          id,
          (s) => ({
            status: STATUS.NEEDS_DOCUMENT_FIX,
            managementReview: {
              decision: 'returned',
              note: note ?? '',
              decidedAt: now(),
              decidedBy: actor?.name ?? '',
            },
            verification: {
              ...s.verification,
              status: 'revision_requested',
              requestedAt: now(),
              requestedBy: actor?.name ?? '',
              notes: [{ field: 'Tinjauan manager', reason: note ?? '' }],
            },
          }),
          entry('Manager mengembalikan profil untuk diperbaiki', actor?.name ?? ''),
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
          { status: STATUS.REGISTRATION, verification: { status: 'pending', notes: [] } },
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
                  status: STATUS.REGISTRATION,
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

      /**
       * Menyimpan kualifikasi pemasok. Baris kosong dibuang di sini supaya
       * baris sisa saat mengisi tidak ikut tersimpan sebagai data.
       */
      saveQualification(supplierId, lines, status, actor, header = {}) {
        const kept = lines.filter(
          (line) => line.commodityCode || line.countryCode || line.notes?.trim(),
        );
        const previous = state.qualifications[supplierId];

        dispatch({
          type: 'SAVE_QUALIFICATION',
          supplierId,
          qualification: {
            lines: kept,
            header: {
              sourcingMethod: SOURCING_METHOD.DIRECT_CHOOSE,
              tenderOutcome: TENDER_OUTCOME.PENDING,
              ...previous?.header,
              ...header,
            },
            status,
            updatedAt: now(),
            updatedBy: actor?.name ?? '',
          },
        });

        /*
         * Kualifikasi yang selesai langsung menjadikan pemasok preferred.
         * Tidak ada lagi antrean persetujuan manager di tengah jalan: penilaian
         * sudah terjadi lebih dulu lewat verifikasi dokumen dan validasi
         * kuesioner, sehingga menahan pemasok sekali lagi hanya menambah tunggu.
         * Manager tetap dapat mendiskualifikasi lewat modul Preferred Supplier.
         */
        const promoted =
          status === 'completed' &&
          [STATUS.QUALIFICATION, STATUS.AWAITING_PREFERRED].includes(
            state.submissions.find((s) => s.id === supplierId)?.status,
          );

        patch(
          supplierId,
          promoted
            ? {
                status: STATUS.PREFERRED,
                preferredDecision: {
                  decision: 'approved',
                  note: 'Otomatis setelah kualifikasi diselesaikan.',
                  decidedAt: now(),
                  decidedBy: actor?.name ?? 'Sistem',
                },
              }
            : {},
          entry(
            status === 'completed'
              ? `Kualifikasi diselesaikan (${kept.length} baris)${promoted ? ', pemasok menjadi preferred' : ''}`
              : 'Draf kualifikasi disimpan',
            actor?.name ?? '',
          ),
        );
      },

      /**
       * Menyunting profil akun pengguna internal yang sedang masuk.
       *
       * Hanya menyentuh sesi, bukan `INTERNAL_USERS`: direktori itu mewakili
       * data kepegawaian yang pada sistem sungguhan datang dari sumber lain
       * (SSO atau HRIS), bukan sesuatu yang aplikasi ini miliki. Karena itu
       * perubahannya ikut hilang saat keluar — sama seperti data lain di
       * aplikasi tanpa backend ini.
       */
      updateInternalProfile(patch) {
        dispatch({ type: 'UPDATE_SESSION_USER', patch });
      },

      /* ---------------- Master Data Management & SAP ---------------- */

      /**
       * Mengirim data pemasok preferred ke SAP. Tanpa backend, keberhasilan
       * disimulasikan lewat `outcome`: 'success' mencatat pengiriman, 'failed'
       * menuliskan entri pada log kegagalan supaya tim MDM dapat menelusurinya.
       */
      submitToSap(id, { outcome = 'success', errorCode = '', message = '' } = {}, actor) {
        const stamp = now();
        const record = {
          at: stamp,
          by: actor?.name ?? '',
          outcome,
          errorCode,
          message,
        };

        if (outcome === 'success') {
          patch(
            id,
            (s) => ({
              sap: {
                status: SAP_STATUS.SUBMITTED,
                submittedAt: stamp,
                submittedBy: actor?.name ?? '',
                sapVendorCode: `V${String(Math.floor(100000 + Math.random() * 899999))}`,
                history: [...(s.sap?.history ?? []), record],
              },
            }),
            entry('Data pemasok dikirim ke SAP', actor?.name ?? ''),
          );
          return { ok: true };
        }

        const log = {
          id: `sapfail_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          supplierId: id,
          at: stamp,
          by: actor?.name ?? '',
          errorCode: errorCode || 'SAP_UNKNOWN',
          message: message || 'Pengiriman ditolak SAP tanpa keterangan.',
          resolvedAt: null,
          resolvedBy: null,
          resolution: null,
        };
        dispatch({ type: 'SAP_LOG', log });
        patch(
          id,
          (s) => ({
            sap: {
              ...s.sap,
              status: SAP_STATUS.FAILED,
              lastFailureAt: stamp,
              lastErrorCode: log.errorCode,
              lastErrorMessage: log.message,
              history: [...(s.sap?.history ?? []), record],
            },
          }),
          entry(`Pengiriman ke SAP gagal (${log.errorCode})`, actor?.name ?? ''),
        );
        return { ok: false, log };
      },

      /** MDM mengembalikan pemasok ke procurement untuk diperbaiki. */
      requestSapRevision(id, reason, actor) {
        patch(
          id,
          (s) => ({
            sap: {
              ...s.sap,
              status: SAP_STATUS.REVISION_REQUESTED,
              revisionReason: reason,
              revisionRequestedAt: now(),
              revisionRequestedBy: actor?.name ?? '',
              history: [
                ...(s.sap?.history ?? []),
                { at: now(), by: actor?.name ?? '', outcome: 'revision_requested', message: reason },
              ],
            },
          }),
          entry('MDM meminta revisi sebelum kirim ke SAP', actor?.name ?? ''),
        );
      },

      resolveSapLog(logId, resolution, actor) {
        dispatch({ type: 'RESOLVE_SAP_LOG', logId, resolution, actor: actor?.name ?? '' });
      },

      /**
       * Status active/blocked datang dari SAP. Aksi ini mensimulasikan dorongan
       * itu supaya alurnya dapat ditelusuri tanpa server.
       */
      pushAccountStatus(id, accountStatus, reason, actor) {
        patch(
          id,
          {
            accountStatus,
            accountStatusReason: reason,
            accountStatusAt: now(),
          },
          entry(
            accountStatus === ACCOUNT_STATUS.BLOCKED
              ? 'Status Blocked diterima dari SAP'
              : 'Status Active diterima dari SAP',
            actor?.name ?? 'SAP',
          ),
        );
      },

      /**
       * Menyunting satu bagian data vendor dari konsol internal.
       *
       * Berbeda dari `updateActiveProfile` yang dipakai pemasok: perubahan dari
       * sisi internal tidak memicu verifikasi ulang, karena yang menyuntingnya
       * justru tim yang akan memverifikasi. Bagian pendaftaran (`general`,
       * `address`, `contact`) tinggal di akar pengajuan, sedangkan lima bagian
       * sisanya di dalam `profile` — percabangan itu ditangani di sini supaya
       * pemanggilnya cukup menyebut nama bagiannya.
       */
      updateVendorSection(id, sectionId, values, actor) {
        const atRoot = ['general', 'address', 'contact'].includes(sectionId);
        patch(
          id,
          (s) =>
            atRoot
              ? { [sectionId]: values }
              : { profile: { ...s.profile, [sectionId]: values } },
          entry(`Bagian ${sectionId} disunting dari konsol internal`, actor?.name ?? ''),
        );
      },

      /**
       * Pembaruan data vendor secara internal. Pada sistem sungguhan ini
       * memicu pengambilan data dari SAP lewat MMI001; di sini hasilnya
       * disimulasikan dan hanya dicatat pada linimasa.
       */
      recordSapFetch(id, fields, actor) {
        patch(
          id,
          (s) => ({
            sapFetch: {
              at: now(),
              by: actor?.name ?? '',
              transaction: 'MMI001',
              fields,
              previous: s.sapFetch ?? null,
            },
          }),
          entry('Data vendor ditarik dari SAP (MMI001)', actor?.name ?? ''),
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

/**
 * Staf Procurement dan Staf Procurement Admin memiliki wewenang yang sama.
 * Pembedaan sebelumnya dihapus atas permintaan tim procurement, sehingga
 * kedua role dapat memilih jalur registrasi internal maupun mengisi profil.
 */
export function canUseInternalPath(user) {
  return user?.role === ROLE.STAFF || user?.role === ROLE.ADMIN;
}

export function isManager(user) {
  return user?.role === ROLE.MANAGER;
}

/** Tim Master Data Management — pemegang gerbang terakhir sebelum SAP. */
export function isMdm(user) {
  return user?.role === ROLE.MDM;
}

/** Role procurement; MDM sengaja tidak termasuk agar tidak menyunting profil. */
export function isProcurement(user) {
  return [ROLE.STAFF, ROLE.ADMIN, ROLE.MANAGER].includes(user?.role);
}


