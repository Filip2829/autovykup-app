const internalActions = new Set(['save', 'note', 'offer', 'supplement', 'convert', 'retry_mail']);
const publicTestActions = new Set(['begin', 'upload', 'remove_photo', 'submit']);

export function valuationAccess(environment, publicTestFlag, mailMode, action) {
  if (!['test', 'production'].includes(environment)) throw new Error('Chybí platné VALUATION_ENV.');
  const isTest = environment === 'test';
  const publicTest = isTest && publicTestFlag === 'true';
  if (publicTest && mailMode !== 'paused') throw new Error('Veřejný test vyžaduje pozastavené e-maily.');
  const internal = internalActions.has(action);
  return {
    isTest,
    internal,
    requiresStaff: internal || (isTest && !(publicTest && publicTestActions.has(action))),
    mailAllowed: !isTest && mailMode === 'live',
    actionAllowed: !(isTest && ['offer', 'supplement', 'retry_mail'].includes(action)),
  };
}
