export function ownerCanSetupAdmin(request, ownerEmail) {
  return Boolean(ownerEmail && request.headers.get('oai-authenticated-user-id') &&
    request.headers.get('oai-authenticated-user-email')?.toLowerCase() === ownerEmail.toLowerCase());
}
