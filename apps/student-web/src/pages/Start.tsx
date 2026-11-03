/** PRIMARY QUESTION (public /start): "Where could I study in Korea?" — V27 (REPORT §356).
 *
 * The same quick fit as the marketing `/start` (`@hangyul/ui` QuickFitForm / QuickFitResults, one endpoint, one
 * registry): four questions, every relevant university in four honest groups, value before an account. The answers
 * ride in the URL into registration (`fitParams` → `Register` → `applyQuickToProfile`), with a `?plan=` kept intact.
 */
import { useApi, useAuth } from '@hangyul/auth';
import { ArrowRight } from '@hangyul/icons';
import { EMPTY_FIT_ANSWERS, fitComplete, fitGpa, fitParams, readFitAnswers, type FitAnswers, type FitInput, type FitItem } from '@hangyul/types';
import { ButtonLink, CountrySelect, Field, LocaleSelector, Logo, QuickFitForm, QuickFitResults, Skeleton } from '@hangyul/ui';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { useT } from '../lib/i18n';
import { readPlanParam } from '../lib/quick';
import { useCountries } from '../lib/queries';

const toInput = (a: FitAnswers): FitInput => ({ nationality: a.nationality, level: a.level as FitInput['level'], gpa: fitGpa(a), languages: a.languages });

export default function Start() {
  const { t, locale } = useT();
  const api = useApi();
  const { status } = useAuth();
  const countries = useCountries();
  const [sp, setSp] = useSearchParams();
  const plan = readPlanParam(sp);
  const [a, setA] = useState<FitAnswers>(() => ({ ...EMPTY_FIT_ANSWERS, ...readFitAnswers(sp) }));
  const [input, setInput] = useState<FitInput | null>(null);
  const run = useMutation({ mutationFn: (body: FitInput) => api.public.fit(body) });
  const ran = useRef(false);

  const params = (extra?: Record<string, string>) => {
    const q = fitParams(a);
    if (plan) { q.set('plan', plan); q.set('next', `/services?plan=${encodeURIComponent(plan)}`); }
    for (const [k, v] of Object.entries(extra ?? {})) q.set(k, v);
    return q.toString();
  };
  const submit = () => { const body = toInput(a); setInput(body); run.mutate(body); setSp(params(), { replace: true }); };
  // Arriving from the marketing site with every answer: show results straight away.
  useEffect(() => { if (!ran.current && fitComplete(a)) { ran.current = true; submit(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const hrefFor = (it: FitItem) => `/universities/${it.slug}?${params({ lang: locale, from: 'recommendation', fit: it.tier })}`;

  return (
    <div className="qs">
      <header className="qs-top">
        <Logo />
        <div className="hg-row" style={{ gap: 8 }}>
          <LocaleSelector compact />
          <Link to="/login" className="hg-link hg-small">{t('common:actions.signIn')}</Link>
        </div>
      </header>
      <main className="qs-main" id="main">
        <div className="qs-intro">
          <h1 className="qs-title">{t('common:fit.title')}</h1>
          <p className="hg-muted">{t('common:fit.lede')}</p>
        </div>
        <QuickFitForm
          value={a} onChange={setA} onSubmit={submit} busy={run.isPending}
          submitLabel={t('common:fit.submit')} footnote={t('common:fit.noAccount')}
          countrySelect={(
            <Field label={t('common:fit.q.nationality')}>
              {countries.isLoading ? <Skeleton h={44} /> : (
                <CountrySelect countries={countries.data ?? []} value={a.nationality} onChange={(v) => setA({ ...a, nationality: v })} label={t('common:fit.q.nationality')} />
              )}
            </Field>
          )}
        />
        {run.isError && <p className="hg-error" role="alert">{t('common:states.errorDetail', { defaultValue: t('common:states.error') })}</p>}
        {run.data && input && (
          <QuickFitResults first={run.data} input={input} run={(body) => api.public.fit(body)} hrefFor={hrefFor}
            after={(
              <div className="qs-cta">
                {status === 'authenticated' ? (
                  <ButtonLink as={Link} to={plan ? `/services?plan=${plan}` : '/explore?tab=foryou'} variant="primary" size="lg" iconEnd={<ArrowRight className="hg-flip-rtl" />}>{t('start.result.seeMine')}</ButtonLink>
                ) : (
                  <>
                    <ButtonLink as={Link} to={`/register?${params()}`} variant="primary" size="lg" iconEnd={<ArrowRight className="hg-flip-rtl" />}>{t('start.result.create')}</ButtonLink>
                    <span className="hg-small hg-muted">{t('start.result.createWhy')}</span>
                  </>
                )}
              </div>
            )} />
        )}
      </main>
    </div>
  );
}
