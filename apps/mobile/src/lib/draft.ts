import type { Intake } from '@intake/shared';
let draft: Intake | null = null;
export const getDraft = () => draft;
export const setDraft = (value: Intake | null) => { draft = value; };
