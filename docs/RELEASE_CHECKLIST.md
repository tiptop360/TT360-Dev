# TT360 Release Checklist

## Pull gate

- [ ] Correct store confirmed
- [ ] Correct staging theme ID confirmed
- [ ] Working tree clean before `pull-staging`

## Local change gate

- [ ] Diff limited to intended files
- [ ] No secrets or generated noise added
- [ ] Theme files updated only in scoped surface

## Static validation gate

- [ ] `npm run theme:check` passed
- [ ] Any task-specific validation passed

## Preview gate

- [ ] `npm run theme:push:staging` completed
- [ ] Preview URL opened
- [ ] Desktop QA passed
- [ ] Mobile QA passed
- [ ] Console clean on changed surface

## Release gate

- [ ] PR approved
- [ ] Release note created in `releases/`
- [ ] Git tag created from tested commit
- [ ] GitHub Release drafted/published

## Publish gate

- [ ] Staging theme published
- [ ] Publish timestamp captured
- [ ] Theme ID captured
- [ ] Operator captured

## Post-publish gate

- [ ] Homepage smoke test passed
- [ ] Navigation smoke test passed
- [ ] Collection page smoke test passed
- [ ] PDP smoke test passed
- [ ] Cart smoke test passed
- [ ] Rollback target confirmed
