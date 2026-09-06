import { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import {
  QUESTIONNAIRE_TEMPLATES,
  QUESTIONNAIRE_VERSIONS,
  QUESTION_LIBRARY,
  SECTION_LIBRARY,
} from './questionnaireMockData.js';
import {
  TEMPLATE_STATUS,
  archive,
  createNextVersion,
  makeId,
  makeTemplate,
  makeVersion,
  publish,
  unpublish,
} from '../engine/index.js';

/**
 * Store questionnaire, terpisah dari `AppStore` pendaftaran pemasok.
 *
 * Dipisah karena dua alasan: `AppStore` sudah padat, dan siklus hidup
 * questionnaire tidak bersinggungan dengan siklus hidup pendaftaran selain
 * lewat identitas pemasok. Memisahkannya membuat kedua alur bisa ditelusuri
 * sendiri-sendiri.
 */

const StateContext = createContext(null);
const ActionsContext = createContext(null);

const now = () => new Date().toISOString();

const initialState = {
  templates: QUESTIONNAIRE_TEMPLATES,
  versions: QUESTIONNAIRE_VERSIONS,
  questionLibrary: QUESTION_LIBRARY,
  sectionLibrary: SECTION_LIBRARY,
  auditLog: [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_TEMPLATE':
      return {
        ...state,
        templates: [action.template, ...state.templates],
        versions: [action.version, ...state.versions],
      };

    case 'PATCH_TEMPLATE':
      return {
        ...state,
        templates: state.templates.map((template) =>
          template.id === action.id
            ? { ...template, ...action.patch, updatedAt: now() }
            : template,
        ),
      };

    case 'REPLACE_VERSION':
      return {
        ...state,
        versions: state.versions.map((version) =>
          version.id === action.version.id ? action.version : version,
        ),
      };

    case 'ADD_VERSION':
      return { ...state, versions: [action.version, ...state.versions] };

    case 'LOG':
      return { ...state, auditLog: [action.entry, ...state.auditLog] };

    default:
      return state;
  }
}

export function QuestionnaireStoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  /** Setiap tindakan penting dicatat, sesuai bagian 22 spesifikasi. */
  const log = useCallback((actor, actionName, objectType, objectId, previous, next) => {
    dispatch({
      type: 'LOG',
      entry: {
        id: makeId('log'),
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? 'Sistem',
        action: actionName,
        objectType,
        objectId,
        previousValue: previous ?? null,
        newValue: next ?? null,
        at: now(),
      },
    });
  }, []);

  const actions = useMemo(
    () => ({
      /* ----------------------- Template ----------------------- */
      createTemplate(input, actor) {
        const template = makeTemplate({
          ...input,
          ownerId: actor?.id ?? '',
          ownerName: actor?.name ?? '',
        });
        const version = makeVersion({
          templateId: template.id,
          scoringEnabled: Boolean(input.scoringEnabled),
        });

        dispatch({ type: 'ADD_TEMPLATE', template, version });
        log(actor, 'questionnaire.created', 'template', template.id, null, template.name);

        return { template, version };
      },

      updateTemplate(id, patch, actor) {
        dispatch({ type: 'PATCH_TEMPLATE', id, patch });
        log(actor, 'questionnaire.edited', 'template', id, null, JSON.stringify(patch));
      },

      duplicateTemplate(templateId, actor) {
        const source = state.templates.find((t) => t.id === templateId);
        const sourceVersion = latestVersionOf(state.versions, templateId);
        if (!source || !sourceVersion) return null;

        const template = makeTemplate({
          ...source,
          id: undefined,
          code: `${source.code}-COPY`,
          name: `${source.name} (salinan)`,
          ownerId: actor?.id ?? '',
          ownerName: actor?.name ?? '',
        });
        const version = {
          ...createNextVersion(sourceVersion, { label: 'v1.0' }),
          templateId: template.id,
        };

        dispatch({ type: 'ADD_TEMPLATE', template, version });
        log(actor, 'questionnaire.duplicated', 'template', template.id, source.name, template.name);

        return { template, version };
      },

      /* ------------------------ Versi ------------------------- */
      saveVersion(version, actor) {
        dispatch({ type: 'REPLACE_VERSION', version: { ...version } });
        log(actor, 'questionnaire.version_saved', 'version', version.id, null, version.versionLabel);
      },

      publishVersion(versionId, actor) {
        const version = state.versions.find((v) => v.id === versionId);
        if (!version) return { ok: false, message: 'Versi tidak ditemukan.' };

        try {
          const published = publish(version, actor?.name ?? 'Sistem');
          dispatch({ type: 'REPLACE_VERSION', version: published });
          log(actor, 'questionnaire.published', 'version', versionId, version.status, 'published');
          return { ok: true, version: published };
        } catch (error) {
          return { ok: false, message: error.message };
        }
      },

      unpublishVersion(versionId, actor) {
        const version = state.versions.find((v) => v.id === versionId);
        if (!version) return;
        dispatch({ type: 'REPLACE_VERSION', version: unpublish(version) });
        log(actor, 'questionnaire.unpublished', 'version', versionId, version.status, 'unpublished');
      },

      archiveVersion(versionId, actor) {
        const version = state.versions.find((v) => v.id === versionId);
        if (!version) return;
        dispatch({ type: 'REPLACE_VERSION', version: archive(version) });
        log(actor, 'questionnaire.archived', 'version', versionId, version.status, 'archived');
      },

      createNewVersion(versionId, actor) {
        const version = state.versions.find((v) => v.id === versionId);
        if (!version) return null;

        const next = createNextVersion(version);
        dispatch({ type: 'ADD_VERSION', version: next });
        log(
          actor,
          'questionnaire.version_created',
          'version',
          next.id,
          version.versionLabel,
          next.versionLabel,
        );

        return next;
      },
    }),
    [log, state.templates, state.versions],
  );

  return (
    <StateContext.Provider value={state}>
      <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
    </StateContext.Provider>
  );
}

export function useQuestionnaireState() {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error('useQuestionnaireState harus dipakai di dalam QuestionnaireStoreProvider.');
  return ctx;
}

export function useQuestionnaireActions() {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error('useQuestionnaireActions harus dipakai di dalam QuestionnaireStoreProvider.');
  return ctx;
}

/* -------------------------- Pembantu -------------------------- */

export function versionsOf(versions, templateId) {
  return versions
    .filter((version) => version.templateId === templateId)
    .sort((a, b) => b.versionLabel.localeCompare(a.versionLabel, undefined, { numeric: true }));
}

export function latestVersionOf(versions, templateId) {
  return versionsOf(versions, templateId)[0] ?? null;
}

/**
 * Versi yang mewakili sebuah template pada daftar: yang terbit bila ada,
 * selain itu yang terbaru. Daftar template menampilkan status ini.
 */
export function representativeVersion(versions, templateId) {
  const all = versionsOf(versions, templateId);
  return all.find((v) => v.status === TEMPLATE_STATUS.PUBLISHED) ?? all[0] ?? null;
}
