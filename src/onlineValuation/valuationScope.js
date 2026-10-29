export function valuationScope(isTest, configuredFunction) {
  return {
    functionName: isTest ? 'online-valuation-public-test' : configuredFunction || 'online-valuation-intake',
    formUrl: isTest ? 'https://autovykup-naceneni-test.vercel.app/naceneni-vozu' : '/naceneni-vozu',
  };
}
