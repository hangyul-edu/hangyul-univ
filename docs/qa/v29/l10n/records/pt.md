# V29 l10n record — pt (European Portuguese)

Scope: V29 service-contract strings (`scripts/i18n/v28/jobs-v29/pt.json` → `scripts/i18n/v28/tx-v29/pt.json`). Korean is canonical, English second reference. Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=pt` → 0 problems.

## Personas

- Estudante de 18 anos em Lisboa a pensar numa licenciatura na Coreia
- Encarregado de educação que compara os três planos e procura custos escondidos
- Candidato a mestrado (27) que quer saber exatamente quantas rondas de revisão tem

## Key term decisions

- **No round limit within the contracted documents**: "Sem limite de rondas nos documentos contratados"; nota: "dentro dos documentos de candidatura e do calendário contratados". Nunca "ilimitado".
- **Up to N managed applications**: "Gestão de até 2 candidaturas a universidades" / "Até 3 candidaturas geridas pela equipa" — reformulado para evitar que "geridas" se leia como 'universidades geridas'. Distinto de "universidades recomendadas".
- **Custom quote**: "Orçamento à medida".
- **Airport pickup arrangement**: "Organização da recolha no aeroporto"; nota: "organizada através de uma empresa de transporte parceira".
- **PT-PT**: equipa, candidatura, propinas, registo, ecrã; sem "você" (formas impessoais e "o seu"/"consigo"); "Mudança de plano" para upgrade como no bundle.
- **Day counts**: "Dias a partir da primeira consulta: {{count}}" porque support_window_days is 1 or 3 (packages/types/src/plans.ts) and the job has no plural pair for these keys.

## Glossary

| Concept | EN | pt |
|---|---|---|
| Plan names | Everything in Basic · up to 5 recommendations | Tudo do Basic · até 5 recomendações |
| No round limit within contracted documents | No round limit within your contracted documents | Sem limite de rondas nos documentos contratados |
| Premium editing scope note | Premium editing has no round limit within your contracted application documents and schedule. | No Premium, a revisão não tem limite de rondas, dentro dos documentos de candidatura e do calendário contratados. |
| Up to N managed applications | Up to 2 university applications managed | Gestão de até 2 candidaturas a universidades |
| Applications managed (row) | Applications managed | Candidaturas geridas |
| Universities recommended (row) | Universities recommended | Universidades recomendadas |
| Custom quote | Custom quote | Orçamento à medida |
| Airport pickup arrangement | Airport pickup arrangement | Organização da recolha no aeroporto |
| Pickup note | Airport pickup is arranged through a partner transport provider. | A recolha no aeroporto é organizada através de uma empresa de transporte parceira. |
| Diagnostic consultation | Schedule the diagnostic consultation | Marcar a consulta de diagnóstico |
| Follow-up consultation | {{count}} follow-up consultation | {{count}} consulta de acompanhamento |
| Statement & study-plan editing | Statement & study-plan editing | Carta de motivação e plano de estudos |
| Editing round | 1 round | 1 ronda |
| Mock interview | Mock interview | Entrevista de treino |
| Dormitory | Dormitory | Residência |
| Settling in | Arrival & settling in | Chegada e instalação |
| Additional service (add-on) | Additional services | Serviços adicionais |
| Agreed scope | Agreed scope | Âmbito acordado |
| Dedicated team · priority | Dedicated team · priority | Equipa dedicada · prioridade |
| Priority response | Priority response | Resposta prioritária |
| Contract term | Contract term | Duração do contrato |
| Service period | Service period | Período do serviço |
| Visa decision disclaimer | Visa support means help preparing and applying; the decision is the authority's. | O apoio ao visto consiste em ajudar a preparar e a apresentar o pedido; a decisão cabe à autoridade competente. |
| Upgrade | Ask the team about upgrading | Perguntar à equipa sobre a mudança de plano |
| Not included / Included | Not included | Não incluído |
| Notarization | Writing a new document, translation and notarization may cost extra. | A redação de um documento novo, a tradução e o reconhecimento notarial podem ter custos adicionais. |

## Review passes

### Pass A — meaning vs Korean — 4 strings changed

- "Até 2 candidaturas a universidades geridas pela equipa" → "Gestão de até 2 candidaturas a universidades"
- "{{count}} dias a partir da primeira consulta" → "Dias a partir da primeira consulta: {{count}}"
- "revisão ilimitada" → "sem limite de rondas"
- "a decisão é da autoridade" → "a decisão cabe à autoridade competente"
- "Recolha no aeroporto" → "Organização da recolha no aeroporto"

### Pass B — native naturalness — 3 strings changed

- "Toda a ajuda que precisa" → "A ajuda de que precisa"
- "taxas escolares" → "propinas"
- "notarização" → "reconhecimento notarial"
- "Tente de novo em um momento" → "Tente novamente daqui a pouco"
- "no seu contrato de serviço ou pedido" → "no contrato de serviço ou na encomenda"

### Pass C — UI brevity / one term per concept — 2 strings changed

- "Revisão da carta de motivação e do plano de estudos" → linha: "Carta de motivação e plano de estudos"
- "Serviço extra" / "Serviço adicional" → "Serviço adicional" em todo o lado
- "Definido em conjunto no início do serviço" → móvel: "Definido no início do serviço"
- "Acompanhamento da equipa responsável" → móvel: "Acompanhamento da equipa"
- "Alojamento" / "Residência" → "Residência" (dormitório universitário)

## Final source↔target comparison

Every key re-read against Korean: no "unlimited" rendering, managed applications never phrased as a guarantee or as "apply to any N", recommended vs managed kept as two different nouns, visa decision attributed to the authority, airport pickup phrased as arranged through a partner, no currency amount translated; all {{placeholders}} and <br> kept.

## Marketing scorecard (marketing:v29.why.*)

| Section | Clarity | Trust | Naturalness | Brevity | CTA | Cultural fit | Total |
|---|---|---|---|---|---|---|---|
| v29.why.s1 (title + text) | 5 | 4 | 5 | 4 | 4 | 4 | 26/30 |
| v29.why.s3 (title + text) | 5 | 5 | 4 | 4 | 4 | 4 | 26/30 |

## Unsure

- "1 marcação" como unidade para a recolha no aeroporto.
- "Obrigado por aceitar" — género da marca, aceitável em PT-PT.
- "Consulta de diagnóstico" pode soar clínico; mantido por fidelidade a 진단 상담.

## Counts

- Job keys: 158 (all had `current: null`)
- Kept verbatim: 0
- Rewritten: 0
- Newly translated: 158
- Extra CLDR plural forms added: 0

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
