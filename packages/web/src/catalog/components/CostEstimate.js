import React, { useState, useMemo, useCallback } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import { Body1, Body2, Caption1, Card, Label, Select, Slider, Subtitle2, makeStyles, tokens, } from '@fluentui/react-components';
import { MoneyRegular } from '@fluentui/react-icons';
const SkuOptionSchema = z.object({
    label: DynamicStringSchema,
    value: DynamicStringSchema,
    monthlyEstimate: z.number(),
});
const ResourceRowSchema = z.object({
    name: DynamicStringSchema,
    sku: DynamicStringSchema.optional(),
    monthlyEstimate: z.number(),
    skuOptions: z.array(SkuOptionSchema).optional(),
});
const CostEstimateApi = {
    name: 'CostEstimate',
    schema: z.object({
        resources: z.array(ResourceRowSchema),
        total: z.number().optional(),
        currency: DynamicStringSchema.optional(),
        title: DynamicStringSchema.optional(),
        projectionMonths: z.number().optional(),
        showProjectionSlider: z.boolean().optional(),
    }).strict(),
};
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
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: tokens.fontFamilyBase,
    },
    th: {
        textAlign: 'left',
        padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
        borderBottomWidth: tokens.strokeWidthThin,
        borderBottomStyle: 'solid',
        borderBottomColor: tokens.colorNeutralStroke2,
        backgroundColor: tokens.colorNeutralBackground2,
        fontSize: tokens.fontSizeBase200,
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorNeutralForeground2,
    },
    thRight: {
        textAlign: 'right',
    },
    td: {
        padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
        borderBottomWidth: tokens.strokeWidthThin,
        borderBottomStyle: 'solid',
        borderBottomColor: tokens.colorNeutralStroke3,
        fontSize: tokens.fontSizeBase300,
        color: tokens.colorNeutralForeground1,
    },
    tdRight: {
        textAlign: 'right',
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
        textAlign: 'right',
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
        textAlign: 'right',
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
        textAlign: 'right',
    },
    empty: {
        padding: tokens.spacingHorizontalM,
        color: tokens.colorNeutralForeground3,
        textAlign: 'center',
    },
});
export const CostEstimate = createReactComponent(CostEstimateApi, ({ props, context }) => {
    const classes = useStyles();
    const currency = props.currency ?? 'USD';
    const resources = props.resources ?? [];
    // Track SKU selections per resource index
    const [skuSelections, setSkuSelections] = useState({});
    const [sliderMonths, setSliderMonths] = useState(props.projectionMonths ?? 1);
    const handleSkuChange = useCallback((resourceIndex, skuValue) => {
        setSkuSelections(prev => ({ ...prev, [resourceIndex]: skuValue }));
        // Dispatch SKU change to backend
        const resource = resources[resourceIndex];
        if (resource) {
            context.dispatchAction({
                event: {
                    name: 'cost-estimate:sku-change',
                    context: {
                        resourceName: typeof resource.name === 'string' ? resource.name : '',
                        selectedSku: skuValue,
                        resourceIndex,
                    },
                },
            });
        }
    }, [resources, context]);
    // Compute effective monthly estimates considering SKU selections
    const effectiveResources = useMemo(() => {
        return resources.map((r, i) => {
            const selectedSku = skuSelections[i];
            if (selectedSku && r.skuOptions) {
                const option = r.skuOptions.find(o => (typeof o.value === 'string' ? o.value : '') === selectedSku);
                if (option) {
                    return {
                        ...r,
                        sku: typeof option.label === 'string' ? option.label : selectedSku,
                        monthlyEstimate: option.monthlyEstimate,
                    };
                }
            }
            return r;
        });
    }, [resources, skuSelections]);
    const computedTotal = effectiveResources.reduce((sum, r) => sum + (r.monthlyEstimate ?? 0), 0);
    const displayTotal = props.total ?? computedTotal;
    const projectionMonths = props.showProjectionSlider ? sliderMonths : (props.projectionMonths ?? 1);
    const showProjection = projectionMonths > 1;
    const formatCost = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
    const hasSkuOptions = resources.some(r => r.skuOptions && r.skuOptions.length > 0);
    return (<Card className={classes.root}>
      <div className={classes.header}>
        <MoneyRegular />
        <Subtitle2>{props.title ?? 'Estimated Monthly Cost'}</Subtitle2>
      </div>

      {resources.length === 0 ? (<div className={classes.empty}>
          <Caption1>No resources specified.</Caption1>
        </div>) : (<table className={classes.table}>
          <thead>
            <tr>
              <th className={classes.th}>Resource</th>
              {hasSkuOptions && <th className={classes.th}>SKU</th>}
              <th className={`${classes.th} ${classes.thRight}`}>Est. / month</th>
            </tr>
          </thead>
          <tbody>
            {effectiveResources.map((resource, i) => {
                const origResource = resources[i];
                const hasOptions = origResource?.skuOptions && origResource.skuOptions.length > 0;
                const currentSkuValue = skuSelections[i] ??
                    (hasOptions ? (typeof origResource.skuOptions[0].value === 'string' ? origResource.skuOptions[0].value : '') : '');
                return (<tr key={i}>
                  <td className={classes.td}>
                    <div>{typeof resource.name === 'string' ? resource.name : ''}</div>
                    {!hasSkuOptions && resource.sku && (<div className={classes.tdMuted}>{typeof resource.sku === 'string' ? resource.sku : ''}</div>)}
                  </td>
                  {hasSkuOptions && (<td className={classes.td}>
                      {hasOptions ? (<Select className={classes.skuSelect} size="small" value={currentSkuValue} onChange={(_, data) => handleSkuChange(i, data.value)}>
                          {origResource.skuOptions.map((opt, j) => (<option key={j} value={typeof opt.value === 'string' ? opt.value : ''}>
                              {typeof opt.label === 'string' ? opt.label : ''}
                            </option>))}
                        </Select>) : (<span className={classes.tdMuted}>
                          {typeof resource.sku === 'string' ? resource.sku : '—'}
                        </span>)}
                    </td>)}
                  <td className={`${classes.td} ${classes.tdRight}`}>
                    {formatCost(resource.monthlyEstimate)}
                  </td>
                </tr>);
            })}
          </tbody>
          <tfoot>
            <tr className={classes.totalRow}>
              <td className={classes.totalCell} colSpan={hasSkuOptions ? 2 : 1}>Total</td>
              <td className={classes.totalAmount}>{formatCost(displayTotal)}</td>
            </tr>
            {showProjection && (<tr className={classes.projectionRow}>
                <td className={classes.projectionCell} colSpan={hasSkuOptions ? 2 : 1}>
                  Projected {projectionMonths}-month cost
                </td>
                <td className={classes.projectionAmount}>
                  {formatCost(displayTotal * projectionMonths)}
                </td>
              </tr>)}
          </tfoot>
        </table>)}

      {props.showProjectionSlider && (<div className={classes.sliderSection}>
          <Label className={classes.sliderLabel} size="small">Projection</Label>
          <Slider className={classes.slider} min={1} max={36} value={sliderMonths} onChange={(_, data) => setSliderMonths(data.value)} size="small"/>
          <span className={classes.sliderValue}>
            {sliderMonths} {sliderMonths === 1 ? 'month' : 'months'}
          </span>
        </div>)}
    </Card>);
});
//# sourceMappingURL=CostEstimate.js.map