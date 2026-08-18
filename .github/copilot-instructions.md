# GOD4.us — GitHub Copilot Development Instructions

## Project Mission

GOD4.us is a premium Bible reading experience.

The goal is to progressively develop GOD4.us into a production-grade Bible website and application while preserving the existing identity and working functionality.

## Non-Negotiable Design Rules

- Preserve the existing GOD4.us visual design.
- Preserve the existing typography.
- Preserve the existing color palette.
- Preserve the existing branding.
- Preserve existing content unless explicitly instructed otherwise.
- Do not remove existing working features.
- Do not redesign the application unless explicitly requested.
- Prefer improving and extending the existing implementation rather than replacing it.

## Production Safety

The `main` branch is the production branch.

Do not intentionally perform development work directly on `main`.

Normal development must occur on the `development` branch or on a feature branch created from `development`.

Cloudflare automatically deploys `main` to the public production website.

Non-production branches are deployed through Cloudflare Preview.

Changes must be tested in Preview before they are considered ready for production.

Never intentionally bypass the Preview workflow or deploy experimental code directly to production.

## Development Workflow

For each task:

1. Inspect the existing implementation before changing it.
2. Understand how the requested feature interacts with existing functionality.
3. Explain the proposed change in plain English.
4. Make the smallest safe change necessary.
5. Preserve existing working functionality.
6. Test the change.
7. Check for obvious regressions.
8. Verify responsive behavior where applicable.
9. Verify accessibility where applicable.
10. Report what changed and what was tested.
11. Identify anything unfinished or uncertain.
12. Do not recommend merging into `main` until the change has been verified in Cloudflare Preview.

## Engineering Priorities

Prioritize:

- reliability
- maintainability
- modular architecture
- accessibility
- responsive design
- performance
- SEO
- security
- progressive enhancement
- clean separation of concerns

Avoid unnecessary dependencies and unnecessary complexity.

Do not perform large rewrites when incremental refactoring can accomplish the same goal.

## Bible Application Architecture

As GOD4.us grows, maintain clear separation between:

- presentation and visual design
- Bible content/data
- Bible reader functionality
- Scripture search
- Bible translation/version comparison
- bookmarks
- highlights
- notes
- reading history
- reading plans
- text-to-speech
- voice commands
- user accounts and synchronization
- APIs and backend services

Do not unnecessarily couple these systems together.

## Bible Content

Do not invent, alter, paraphrase, or silently correct Scripture text.

Bible translations must come from an identified and legally permitted source.

Preserve translation attribution and licensing requirements.

When translation or licensing status is uncertain, flag the issue rather than making assumptions.

## Accessibility

Work toward WCAG 2.2 AA.

Preserve or improve:

- semantic HTML
- keyboard navigation
- visible focus states
- screen-reader usability
- accessible names and labels
- heading hierarchy
- sufficient contrast
- reduced-motion support where appropriate

Accessibility improvements should preserve the established GOD4.us visual identity whenever possible.

## Performance

Prefer lightweight solutions.

Avoid adding large frameworks or dependencies unless there is a clear architectural reason.

Optimize for fast loading on desktop and mobile connections.

## Security

Never expose passwords, API keys, access tokens, private credentials, or secrets in client-side code or repository files.

Use environment variables or appropriate secret-management systems when credentials are required.

Do not create custom authentication or cryptographic systems when established, secure solutions are appropriate.

## Communication With Project Owner

The GOD4.us project owner has no technical background.

Explain technical decisions in clear, plain English.

Do not assume knowledge of:

- Git
- GitHub
- Cloudflare
- APIs
- databases
- command-line tools
- programming terminology
- deployment systems

When manual action is required, provide simple step-by-step instructions.

Do not overwhelm the project owner with unnecessary technical detail.

## Completion Report

At the end of a development task, clearly state:

- What changed
- Why it changed
- What files changed
- What was tested
- Whether the Cloudflare Preview should be checked
- Any known limitations
- Whether the work appears ready for production review

Do not treat a task as production-ready merely because code was generated successfully.
