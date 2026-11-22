# Learnora platform administrator bootstrap

The platform administrator table has no seeded users. No account is automatically promoted. The `learnora-admin` Edge Function requires a valid Supabase user session and an active `platform_administrators` row with the permission required for each action.

## Assigning the first platform owner

Only an authorised project owner/operator should perform this step after the first Learnora account has registered and its email has been verified.

1. Sign in to Learnora with the account that has been approved to administer the platform.
2. Retrieve that account's UUID from Supabase Auth.
3. Independently confirm the account holder and authority outside the application.
4. In the Supabase SQL Editor, insert the approved UUID using a trusted operator session:

```sql
insert into public.platform_administrators(user_id,role,permissions,status)
values (
  '<VERIFIED_AUTH_USER_UUID>',
  'platform_owner',
  array[
    'platform:dashboard',
    'educators:verify',
    'courses:review',
    'knowledge:publish',
    'guardians:verify',
    'institutions:verify',
    'safeguarding:manage',
    'competencies:verify',
    'opportunities:publish',
    'finance:refund_approve',
    'credentials:issue'
  ],
  'active'
);
```

Replace the placeholder with the verified Auth UUID. Do not paste credentials or private keys into source code, GitHub issues or chat. The table deliberately denies client INSERT/UPDATE/DELETE, so users cannot self-assign administrator access.

## Available administrative permissions

- `platform:dashboard`: read only the review queues allowed by the other permissions on that administrator record.
- `educators:verify`: review educator credential submissions and issue short-lived private evidence links.
- `courses:review`: approve, request changes or reject course publication.
- `knowledge:publish`: publish authorised draft knowledge sources after checking that chunks exist.
- `guardians:verify`: activate/reject guardian relationships. Activation also requires a verified authority reference and exact `LEARNORA_GUARDIAN_CONSENT_VERSION` match.
- `institutions:verify`: activate, suspend or archive an institution.
- `safeguarding:manage`: triage and resolve safeguarding cases.
- `competencies:verify`: verify/reject competency evidence.
- `opportunities:publish`: publish opportunities only when source and verification metadata exist.
- `finance:refund_approve`: approve a refund request. This does not execute the provider refund.
- `credentials:issue`: issue a platform, institution or accredited credential. Accredited claims require a reference.

## Operational cautions

- Do not assign every permission to every administrator. Use least privilege.
- A guardian request uses a draft consent version until qualified legal review approves the final wording. Do not set the approved consent secret before that review.
- Educator evidence links expire after 120 seconds.
- Refund approval is not a completed refund.
- Credential issuance does not make a qualification accredited.
- All administrative actions create an audit event. Review audit records regularly.
- No platform administrator has been assigned yet because there are currently no Auth users.
