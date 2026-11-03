/**
 * **The free product** (V17, REPORT §148; rebuilt in V27, REPORT §356).
 *
 * Four questions — nationality, study level, GPA on the student's own scale, language results — and **every**
 * relevant Korean university in four honest groups, with no account and no payment. V17–V26 answered with six
 * sample programmes from a ten-university catalogue; this answers from the 425-institution directory and the
 * official rules Hangyul has verified, and it says how many those are.
 *
 * **Results do not promise admission.** No percentage anywhere; "추천순" is a browsing order, labelled as such.
 * Every row opens the canonical public university page (`/universities/:slug`) with the answers carried along, and
 * the same answers ride into registration (`fitParams`).
 */
import { useLocale } from '@hangyul/i18n';
import { ArrowRight, MapPin } from '@hangyul/icons';
import { Band, Reveal } from '@hangyul/koreanasha-ui';
import {
  EMPTY_FIT_ANSWERS, fitGpa, fitParams, readFitAnswers, type FitAnswers, type FitInput, type FitItem,
} from '@hangyul/types';
import { ButtonLink, CountrySelect, Field, QuickFitForm, QuickFitResults, Skeleton } from '@hangyul/ui';
import { useApi } from '@hangyul/auth';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { PageIntro } from '../components/blocks';
import '../styles/start.css';

function toInput(a: FitAnswers): FitInput {
  return { nationality: a.nationality, level: a.level as FitInput['level'], gpa: fitGpa(a), languages: a.languages };
}

export default function Start() {
  const { t, locale } = useLocale(['marketing', 'common']);
  const api = useApi();
  const [sp, setSp] = useSearchParams();
  const plan = sp.get('plan');
  const [a, setA] = useState<FitAnswers>(() => ({ ...EMPTY_FIT_ANSWERS, ...readFitAnswers(sp) }));
  const countries = useQuery({ queryKey: ['countries'], queryFn: () => api.meta.countries(undefined, true) });
  const results = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState<FitInput | null>(null);
  const run = useMutation({ mutationFn: (body: FitInput) => api.public.fit(body) });

  const submit = () => {
    const body = toInput(a);
    setInput(body);
    run.mutate(body);
    // The answers live in the URL, so a refresh, a shared link and the hand-off to registration all keep them.
    const next = fitParams(a);
    for (const k of ['lang', 'plan']) if (sp.get(k)) next.set(k, sp.get(k)!);
    setSp(next, { replace: true });
  };
  // The answer is the point of the page, so the page moves to it ('auto': a smooth scroll is still running when
  // the first click lands — V11 trap).
  useEffect(() => { if (run.data) results.current?.scrollIntoView({ behavior: 'auto', block: 'start' }); }, [run.data]);

  const carry = (extra?: Record<string, string>) => {
    const q = fitParams(a);
    q.set('lang', locale);
    for (const [k, v] of Object.entries(extra ?? {})) q.set(k, v);
    return q.toString();
  };
  const hrefFor = (it: FitItem) => `/universities/${it.slug}?${carry({ from: 'recommendation', fit: it.tier })}`;

  return (
    <Band id="quick" labelledBy="quick-title" className="mk-qs" pageTop>
      <Reveal variant="rise">
        <PageIntro id="quick-title" title={t('common:fit.title')} lede={t('common:fit.lede')} />
      </Reveal>

      <Reveal variant="rise" delay={120} className="mk-qs__form">
        <QuickFitForm
          value={a} onChange={setA} onSubmit={submit} busy={run.isPending}
          submitLabel={t('common:fit.submit')} footnote={t('common:fit.noAccount')}
          countrySelect={(
            <Field label={t('common:fit.q.nationality')} className="mk-qs__field">
              {countries.isLoading
                ? <Skeleton h={52} />
                : <CountrySelect countries={countries.data ?? []} value={a.nationality} onChange={(v) => setA({ ...a, nationality: v })} label={t('common:fit.q.nationality')} />}
            </Field>
          )}
        />
        {run.isError && <p className="hg-error" role="alert">{t('common:states.errorDetail', { defaultValue: t('common:states.error') })}</p>}
      </Reveal>

      {run.data && input && (
        <div ref={results} className="mk-qs__results">
          <QuickFitResults
            first={run.data} input={input} run={(body) => api.public.fit(body)} hrefFor={hrefFor}
            after={(
              <>
                {/* The one conversion action on the page, after the value. The answers ride along. */}
                <div className="mk-qs__cta">
                  <ButtonLink as={Link} to={`/?${carry(plan ? { plan } : undefined)}#pricing`} variant="primary" size="lg" iconEnd={<ArrowRight className="hg-flip-rtl" />}>
                    {t('v17.quick.cta')}
                  </ButtonLink>
                  <span className="hg-small hg-subtle">{t('v17.quick.ctaWhy')}</span>
                </div>
                <p className="mk-qs__disclaimer"><MapPin aria-hidden /> {t('v17.quick.notAnOffer')}</p>
              </>
            )}
          />
        </div>
      )}
    </Band>
  );
}
