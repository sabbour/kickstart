import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createReactComponent,
  type ReactA2uiComponentProps,
} from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Badge,
  Body2,
  Button,
  Caption1,
  Card,
  Label,
  MessageBar,
  MessageBarBody,
  Select,
  Slider,
  Spinner,
  Subtitle1,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { MoneyRegular } from '@fluentui/react-icons';
import { useConversationSession } from '../../contexts/ConversationSessionContext';
import { approveCostGate } from '../../services/azure-deployments';
import { fetchCostEstimate } from '../../services/cost-estimates';
import {
  buildCostEstimateNotice,
  getCostEstimateRequestKey,
  normalizeCostEstimateInput,
  normalizeCostEstimatePricingRequest,
  resolveCostEstimateDisplay,
  shouldFetchLivePricing,
  type CostEstimateData,
  type CostEstimateInput,
} from '../../utils/cost-estimate';

const SkuOptionSchema = z.object({
  label: DynamicStringSchema,
  value: DynamicStringSchema,
  monthlyEstimate: z.number(),
}).strip();

const PricingTierSchema = z.object({
  label: DynamicStringSchema,
  monthlyEstimate: z.number(),
}).strip();

const ResourceRowSchema = z.object({
  name: DynamicStringSchema,
  sku: DynamicStringSchema.optional(),
  monthlyEstimate: z.number(),
  pricingModel: z.enum(['monthly', 'usage', 'included']).optional(),
  unitPrice: z.number().optional(),
  unitOfMeasure: DynamicStringSchema.optional(),
  skuOptions: z.array(SkuOptionSchema).optional(),
  pricingTiers: z.array(PricingTierSchema).optional(),
}).strip();

const LegacyCostItemSchema = z.object({
  name: DynamicStringSchema,
  sku: DynamicStringSchema.optional(),
  monthlyCost: z.number(),
}).strip();

const PricingLineItemSchema = z.object({
  id: DynamicStringSchema,
  kind: z.enum([
    'aksAutomaticControlPlane',
    'aksAutomaticSystemNodes',
    'aksAutomaticWorkloadCompute',
    'appRouting',
    'containerRegistry',
    'storage',
    'azureOpenAI',
  ]),
  name: DynamicStringSchema.optional(),
  sku: DynamicStringSchema.optional(),
  quantity: z.number().positive().max(100).optional(),
}).strip();

const PricingRequestSchema = z.object({
  region: DynamicStringSchema,
  lineItems: z.array(PricingLineItemSchema).min(1).max(12),
}).strip();

const LoadingSchema = z.object({
  supported: z.boolean(),
  state: z.enum(['idle', 'loading', 'ready']).optional(),
  message: DynamicStringSchema.optional(),
}).strip();

const CacheSchema = z.object({
  status: z.enum(['miss', 'hit', 'stale']),
  updatedAt: DynamicStringSchema.optional(),
  expiresAt: DynamicStringSchema.optional(),
}).strip();

const FallbackSchema = z.object({
  used: z.boolean(),
  reason: z.enum(['live_pricing_unavailable', 'unsupported_request']).optional(),
  message: DynamicStringSchema.optional(),
}).strip();

const CostEstimateSchema = z.object({
  resources: z.array(ResourceRowSchema).optional(),
  items: z.array(LegacyCostItemSchema).optional(),
  monthlyEstimate: z.number().optional(),
  total: z.number().optional(),
  currency: DynamicStringSchema.optional(),
  title: DynamicStringSchema.optional(),
  projectionMonths: z.number().optional(),
  showProjectionSlider: z.boolean().optional(),
  source: z.enum(['live', 'estimated', 'stub']).optional(),
  citation: DynamicStringSchema.optional(),
  cached: z.boolean().optional(),
  cache: CacheSchema.optional(),
  fallback: z.union([z.boolean(), FallbackSchema]).optional(),
  loading: LoadingSchema.optional(),
  pricingRequest: PricingRequestSchema.optional(),
  estimatedAt: DynamicStringSchema.optional(),
}).strip();

const CostEstimateApi = {
  name: 'CostEstimate',
  schema: CostEstimateSchema,
};

type CostEstimateProps = z.infer<typeof CostEstimateSchema>;

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
    padding: '0',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottomWidth: tokens.strokeWidthThin,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
  },
  sourceBadge: {
    marginLeft: 'auto',
  },
  pricingNotice: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM} 0`,
  },
  loadingState: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalM}`,
  },
  loadingCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },
  loadingTitle: {
    fontWeight: tokens.fontWeightSemibold,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontFamily: tokens.fontFamilyBase,
  },
  th: {
    textAlign: 'left' as const,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    borderBottomWidth: tokens.strokeWidthThin,
    borderBottomStyle: 'solid' as const,
    borderBottomColor: tokens.colorNeutralStroke2,
    backgroundColor: tokens.colorNeutralBackground2,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
  },
  thRight: {
    textAlign: 'right' as const,
  },
  td: {
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    borderBottomWidth: tokens.strokeWidthThin,
    borderBottomStyle: 'solid' as const,
    borderBottomColor: tokens.colorNeutralStroke3,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
  },
  tdRight: {
    textAlign: 'right' as const,
    fontFamily: tokens.fontFamilyMonospace,
  },
  tdMuted: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  skuSelect: {
    minWidth: '140px',
  },
  totalRow: {
    backgroundColor: tokens.colorNeutralBackground2,
  },
  totalCell: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
  },
  totalAmount: {
    textAlign: 'right' as const,
    fontFamily: tokens.fontFamilyMonospace,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorBrandForeground1,
  },
  projectionRow: {
    backgroundColor: tokens.colorNeutralBackground3,
  },
  projectionCell: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  projectionAmount: {
    textAlign: 'right' as const,
    fontFamily: tokens.fontFamilyMonospace,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  sliderSection: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground2,
    borderTopWidth: tokens.strokeWidthThin,
    borderTopStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
  },
  sliderLabel: {
    whiteSpace: 'nowrap',
    minWidth: '80px',
  },
  slider: {
    flex: 1,
    minWidth: '100px',
  },
  sliderValue: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    minWidth: '70px',
    textAlign: 'right' as const,
  },
  empty: {
    padding: tokens.spacingHorizontalM,
    color: tokens.colorNeutralForeground3,
    textAlign: 'center' as const,
  },
  pricingTiers: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    flexWrap: 'wrap' as const,
    marginTop: tokens.spacingVerticalXXS,
  },
  tierBadge: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderTopWidth: tokens.strokeWidthThin,
    borderTopStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
  },
  footerActions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
});

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to fetch live Azure pricing.';
}

export function CostEstimateView({
  props,
  context,
}: ReactA2uiComponentProps<CostEstimateProps>) {
  const classes = useStyles();
  const { backendSessionId, currentPhase } = useConversationSession();
  const pricingRequest = useMemo(
    () => normalizeCostEstimatePricingRequest(props.pricingRequest),
    [props.pricingRequest],
  );
  const initialEstimate = useMemo(
    () => normalizeCostEstimateInput(props as CostEstimateInput),
    [props],
  );
  const canFetchLivePricing = shouldFetchLivePricing(backendSessionId, pricingRequest);
  const pricingRequestKey = useMemo(
    () => getCostEstimateRequestKey(pricingRequest),
    [pricingRequest],
  );

  const [liveEstimate, setLiveEstimate] = useState<CostEstimateData | null>(null);
  const [loadingPricing, setLoadingPricing] = useState(canFetchLivePricing);
  const [pricingError, setPricingError] = useState<string | undefined>();
  const [approving, setApproving] = useState(false);
  const [gateError, setGateError] = useState<string | undefined>();
  const [skuSelections, setSkuSelections] = useState<Record<number, string>>({});
  const [sliderMonths, setSliderMonths] = useState(initialEstimate.projectionMonths ?? 1);

  useEffect(() => {
    setSliderMonths(initialEstimate.projectionMonths ?? 1);
  }, [initialEstimate.projectionMonths]);

  useEffect(() => {
    if (!canFetchLivePricing || !backendSessionId || !pricingRequest) {
      setLiveEstimate(null);
      setLoadingPricing(false);
      setPricingError(undefined);
      return undefined;
    }

    let cancelled = false;
    const abortController = new AbortController();

    setLoadingPricing(true);
    setPricingError(undefined);
    setLiveEstimate(null);

    void fetchCostEstimate(backendSessionId, pricingRequest, abortController.signal)
      .then((estimate) => {
        if (cancelled) return;
        setLiveEstimate(estimate);
        setPricingError(undefined);
        setLoadingPricing(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setLiveEstimate(null);
        setPricingError(readErrorMessage(error));
        setLoadingPricing(false);
      });

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [backendSessionId, canFetchLivePricing, pricingRequest, pricingRequestKey]);

  const displayEstimate = useMemo(() => resolveCostEstimateDisplay({
    initialEstimate,
    fetchedEstimate: liveEstimate,
    pricingRequested: Boolean(pricingRequest),
    pricingFailed: Boolean(pricingError),
    region: pricingRequest?.region,
  }), [initialEstimate, liveEstimate, pricingError, pricingRequest]);

  const notice = useMemo(
    () => buildCostEstimateNotice(displayEstimate, pricingRequest?.region),
    [displayEstimate, pricingRequest?.region],
  );

  const currency = displayEstimate.currency ?? 'USD';
  const resources = displayEstimate.resources;

  useEffect(() => {
    setSkuSelections({});
  }, [resources]);

  const handleSkuChange = useCallback((resourceIndex: number, skuValue: string) => {
    const resource = resources[resourceIndex];
    if (!resource) return;

    const allowed = resource.skuOptions?.map((option) => option.value) ?? [];
    if (!allowed.includes(skuValue)) return;

    setSkuSelections((previous) => ({ ...previous, [resourceIndex]: skuValue }));
    context.dispatchAction({
      event: {
        name: 'cost-estimate:sku-change',
        context: {
          resourceName: resource.name,
          selectedSku: skuValue,
          resourceIndex,
        },
      },
    });
  }, [context, resources]);

  const effectiveResources = useMemo(() => resources.map((resource, index) => {
    const selectedSku = skuSelections[index];
    if (selectedSku && resource.skuOptions) {
      const option = resource.skuOptions.find((candidate) => candidate.value === selectedSku);
      if (option) {
        return {
          ...resource,
          sku: option.label,
          monthlyEstimate: option.monthlyEstimate,
        };
      }
    }
    return resource;
  }), [resources, skuSelections]);

  const computedTotal = effectiveResources.reduce((sum, resource) => sum + (resource.monthlyEstimate ?? 0), 0);
  const hasSelectedSkuOverrides = Object.keys(skuSelections).length > 0;
  const displayTotal = hasSelectedSkuOverrides
    ? computedTotal
    : (
      Number.isFinite(displayEstimate.monthlyEstimate)
        ? displayEstimate.monthlyEstimate
        : computedTotal
    );
  const projectionMonths = displayEstimate.showProjectionSlider
    ? sliderMonths
    : (displayEstimate.projectionMonths ?? 1);
  const showProjection = projectionMonths > 1;
  const hasSkuOptions = resources.some((resource) => resource.skuOptions && resource.skuOptions.length > 0);
  const showApprovalCta = Boolean(backendSessionId) && (currentPhase === 'review' || currentPhase === 'deploy');

  const formatCost = useCallback((amount: number) => (
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
  ), [currency]);

  const formatUnitPrice = useCallback((amount: number) => (
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: amount < 0.01 ? 5 : 2,
      maximumFractionDigits: amount < 0.01 ? 5 : 2,
    }).format(amount)
  ), [currency]);

  const renderResourceEstimate = useCallback((resource: CostEstimateData['resources'][number]) => {
    if (resource.pricingModel === 'included') {
      return (
        <>
          Included
          <div className={classes.tdMuted}>Included with this service</div>
        </>
      );
    }

    if (resource.pricingModel === 'usage') {
      return (
        <>
          {typeof resource.unitPrice === 'number' && resource.unitOfMeasure
            ? `${formatUnitPrice(resource.unitPrice)} / ${resource.unitOfMeasure}`
            : 'Usage-based'}
          <div className={classes.tdMuted}>Excluded from monthly total until usage is known</div>
        </>
      );
    }

    return formatCost(resource.monthlyEstimate);
  }, [classes.tdMuted, formatCost, formatUnitPrice]);

  const handleApprove = useCallback(async () => {
    if (!backendSessionId) return;

    setApproving(true);
    setGateError(undefined);
    try {
      await approveCostGate(backendSessionId, {
        approved: true,
        estimatedMonthlyTotal: displayTotal,
        total: displayTotal,
        currency,
        source: displayEstimate.source ?? 'estimated',
      });
      context.dispatchAction({
        event: {
          name: 'continue:cost-gate-approved',
          context: {
            total: formatCost(displayTotal),
            currency,
            projectionMonths,
          },
        },
      });
    } catch (error) {
      setGateError(error instanceof Error ? error.message : 'Unable to record cost approval.');
    } finally {
      setApproving(false);
    }
  }, [backendSessionId, context, currency, displayEstimate.source, displayTotal, formatCost, projectionMonths]);

  const emptyMessage = pricingError
    ? 'Unable to load pricing right now.'
    : 'No resources specified.';
  const loadingMessage = props.loading?.message ?? 'Fetching live prices from Azure Retail Prices API…';

  return (
    <Card className={classes.root}>
      <div className={classes.header}>
        <MoneyRegular />
        <Subtitle1>{displayEstimate.title ?? 'Monthly cost estimate'}</Subtitle1>
        {notice.badgeLabel && (
          <Badge
            appearance="filled"
            color={notice.badgeColor}
            size="small"
            className={classes.sourceBadge}
          >
            {notice.badgeLabel}
          </Badge>
        )}
      </div>

      {loadingPricing ? (
        <div className={classes.loadingState} aria-live="polite">
          <Spinner size="tiny" />
          <div className={classes.loadingCopy}>
            <Body2 className={classes.loadingTitle}>Loading live pricing…</Body2>
            <Caption1>{loadingMessage}</Caption1>
          </div>
        </div>
      ) : (
        <>
          {notice.message && (
            <div className={classes.pricingNotice}>
              <MessageBar intent={notice.intent ?? 'info'}>
                <MessageBarBody>{notice.message}</MessageBarBody>
              </MessageBar>
            </div>
          )}

          {resources.length === 0 ? (
            <div className={classes.empty}>
              <Caption1>{emptyMessage}</Caption1>
            </div>
          ) : (
            <table className={classes.table}>
              <thead>
                <tr>
                  <th className={classes.th}>Resource</th>
                  {hasSkuOptions && <th className={classes.th}>SKU</th>}
                  <th className={`${classes.th} ${classes.thRight}`}>Est. / month</th>
                </tr>
              </thead>
              <tbody>
                {effectiveResources.map((resource, index) => {
                  const baseResource = resources[index];
                  const hasOptions = Boolean(baseResource?.skuOptions?.length);
                  const currentSkuValue = skuSelections[index]
                    ?? (hasOptions ? baseResource?.skuOptions?.[0]?.value ?? '' : '');

                  return (
                    <tr key={`${resource.name}-${index}`}>
                      <td className={classes.td}>
                        <div>{resource.name}</div>
                        {!hasSkuOptions && resource.sku && (
                          <div className={classes.tdMuted}>{resource.sku}</div>
                        )}
                      </td>
                      {hasSkuOptions && (
                        <td className={classes.td}>
                          {hasOptions ? (
                            <Select
                              className={classes.skuSelect}
                              size="small"
                              value={currentSkuValue}
                              onChange={(_, data) => handleSkuChange(index, data.value)}
                            >
                              {baseResource?.skuOptions?.map((option, optionIndex) => (
                                <option key={`${option.value}-${optionIndex}`} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <span className={classes.tdMuted}>{resource.sku ?? '—'}</span>
                          )}
                        </td>
                      )}
                      <td className={`${classes.td} ${classes.tdRight}`}>
                        {renderResourceEstimate(resource)}
                        {baseResource?.pricingTiers && baseResource.pricingTiers.length > 0 && (
                          <div className={classes.pricingTiers}>
                            {baseResource.pricingTiers.map((tier, tierIndex) => (
                              <span key={`${tier.label}-${tierIndex}`} className={classes.tierBadge}>
                                {tier.label}: {formatCost(tier.monthlyEstimate)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className={classes.totalRow}>
                  <td className={classes.totalCell} colSpan={hasSkuOptions ? 2 : 1}>Total</td>
                  <td className={classes.totalAmount}>{formatCost(displayTotal)}</td>
                </tr>
                {showProjection && (
                  <tr className={classes.projectionRow}>
                    <td className={classes.projectionCell} colSpan={hasSkuOptions ? 2 : 1}>
                      Projected {projectionMonths}-month cost
                    </td>
                    <td className={classes.projectionAmount}>
                      {formatCost(displayTotal * projectionMonths)}
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          )}
        </>
      )}

      {displayEstimate.showProjectionSlider && !loadingPricing && (
        <div className={classes.sliderSection}>
          <Label className={classes.sliderLabel} size="small">Projection</Label>
          <Slider
            className={classes.slider}
            min={1}
            max={36}
            value={sliderMonths}
            onChange={(_, data) => setSliderMonths(data.value)}
            size="small"
          />
          <span className={classes.sliderValue}>
            {sliderMonths} {sliderMonths === 1 ? 'month' : 'months'}
          </span>
        </div>
      )}

      {(gateError || showApprovalCta) && (
        <div className={classes.footer}>
          <div>
            {gateError && (
              <MessageBar intent="error">
                <MessageBarBody>{gateError}</MessageBarBody>
              </MessageBar>
            )}
          </div>
          {showApprovalCta && (
            <div className={classes.footerActions}>
              <Button
                appearance="primary"
                onClick={() => void handleApprove()}
                disabled={approving || loadingPricing || resources.length === 0}
              >
                {approving ? 'Recording approval…' : 'Approve and continue'}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export const CostEstimate = createReactComponent(CostEstimateApi, CostEstimateView);
