/**
 * EconomyMarketCard — rich card for market/artisan/product entities
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EconomyMarketCardProps {
  item: {
    id: string;
    name: string;
    city?: string;
    region?: string;
    type?: string;
    schedule?: string;
    products?: string[];
    description?: string;
    tags?: string[];
    rating?: number;
    craft?: string;
    materials?: string[];
    story?: string;
    category?: string;
    origin?: string;
    dop?: boolean;
    season?: number[];
  };
  variant: 'market' | 'artisan' | 'product';
  expanded?: boolean;
  onPress?: () => void;
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const C = {
  bg: '#FAFAF7',
  card: '#FFFFFF',
  market: '#D97706',
  marketLight: '#FEF3C7',
  artisan: '#7C3AED',
  artisanLight: '#EDE9FE',
  fish: '#0369A1',
  fishLight: '#E0F2FE',
  dop: '#059669',
  dopLight: '#D1FAE5',
  textDark: '#1C1917',
  textMed: '#57534E',
  textLight: '#78716C',
  border: '#E7E5E4',
  accent: '#C2410C',
};

// ─── Type Badge Config ────────────────────────────────────────────────────────

const TYPE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  mercado_municipal: { label: 'Mercado Municipal', color: '#D97706', bg: '#FEF3C7' },
  feira:             { label: 'Feira',              color: '#EA580C', bg: '#FFEDD5' },
  loja_tradicional:  { label: 'Loja Tradicional',   color: '#92400E', bg: '#FEF3C7' },
  coop_produtores:   { label: 'Cooperativa',        color: '#15803D', bg: '#DCFCE7' },
};

// ─── Category Icon Map ────────────────────────────────────────────────────────

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

const CATEGORY_ICON: Record<string, MaterialIconName> = {
  peixe:        'set-meal',
  bebida:       'local-bar',
  panificacao:  'bakery-dining',
  condimento:   'spa',
  laticinios:   'egg',
};

// ─── Month Abbreviations ──────────────────────────────────────────────────────

const MONTH_ABBR = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  const full  = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  return (
    <View style={subStyles.starsRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <MaterialIcons
          key={i}
          name={i <= full ? 'star' : hasHalf && i === full + 1 ? 'star-half' : 'star-border'}
          size={13}
          color="#F59E0B"
        />
      ))}
      <Text style={subStyles.ratingText}>{rating.toFixed(1)}</Text>
    </View>
  );
}

function TagsRow({ tags }: { tags: string[] }) {
  return (
    <View style={subStyles.tagsRow}>
      {tags.map((tag) => (
        <View key={tag} style={subStyles.tagChip}>
          <Text style={subStyles.tagText}>{tag}</Text>
        </View>
      ))}
    </View>
  );
}

function SeasonDots({ season }: { season: number[] }) {
  const currentMonth = new Date().getMonth() + 1;
  return (
    <View style={subStyles.seasonRow}>
      {MONTH_ABBR.map((abbr, idx) => {
        const month = idx + 1;
        const inSeason = season.includes(month);
        const isCurrent = month === currentMonth;
        return (
          <View
            key={month}
            style={[
              subStyles.seasonDot,
              inSeason   ? subStyles.seasonDotIn    : subStyles.seasonDotOut,
              isCurrent  ? subStyles.seasonDotCurrent : null,
            ]}
          >
            <Text
              style={[
                subStyles.seasonDotLabel,
                inSeason  ? subStyles.seasonDotLabelIn  : subStyles.seasonDotLabelOut,
              ]}
            >
              {abbr}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Variant Renderers ────────────────────────────────────────────────────────

function MarketContent({ item, expanded }: { item: EconomyMarketCardProps['item']; expanded: boolean }) {
  const typeConf = item.type ? TYPE_BADGE[item.type] : null;
  const topProducts = (item.products ?? []).slice(0, 3);

  return (
    <>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.itemName}>{item.name}</Text>
          <View style={styles.locationRow}>
            <MaterialIcons name="place" size={12} color={C.textLight} />
            <Text style={styles.locationText}>
              {[item.city, item.region].filter(Boolean).join(', ')}
            </Text>
          </View>
        </View>
        {typeConf && (
          <View style={[styles.typeBadge, { backgroundColor: typeConf.bg }]}>
            <Text style={[styles.typeBadgeText, { color: typeConf.color }]}>
              {typeConf.label}
            </Text>
          </View>
        )}
      </View>

      {/* Schedule */}
      {item.schedule && (
        <View style={styles.scheduleRow}>
          <MaterialIcons name="schedule" size={13} color={C.market} />
          <Text style={styles.scheduleText}>{item.schedule}</Text>
        </View>
      )}

      {/* Top products */}
      {topProducts.length > 0 && (
        <View style={styles.chipsRow}>
          {topProducts.map((p) => (
            <View key={p} style={[styles.chip, { backgroundColor: C.marketLight }]}>
              <Text style={[styles.chipText, { color: C.market }]}>{p}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Rating */}
      {item.rating !== undefined && <StarRating rating={item.rating} />}

      {/* Description */}
      {item.description && (
        <Text style={styles.description} numberOfLines={expanded ? undefined : 2}>
          {item.description}
        </Text>
      )}

      {/* Tags */}
      {(item.tags ?? []).length > 0 && <TagsRow tags={item.tags!} />}
    </>
  );
}

function ArtisanContent({ item, expanded }: { item: EconomyMarketCardProps['item']; expanded: boolean }) {
  return (
    <>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.itemName}>{item.name}</Text>
          {item.city && (
            <View style={styles.locationRow}>
              <MaterialIcons name="place" size={12} color={C.textLight} />
              <Text style={styles.locationText}>
                {[item.city, item.region].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}
        </View>
        {item.craft && (
          <View style={[styles.typeBadge, { backgroundColor: C.artisanLight }]}>
            <Text style={[styles.typeBadgeText, { color: C.artisan }]}>{item.craft}</Text>
          </View>
        )}
      </View>

      {/* Materials */}
      {(item.materials ?? []).length > 0 && (
        <View style={styles.chipsRow}>
          {item.materials!.map((m) => (
            <View key={m} style={[styles.chip, { backgroundColor: C.artisanLight }]}>
              <Text style={[styles.chipText, { color: C.artisan }]}>{m}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Story */}
      {item.story && (
        <Text style={styles.description} numberOfLines={expanded ? undefined : 2}>
          {item.story}
        </Text>
      )}

      {/* Tags */}
      {(item.tags ?? []).length > 0 && <TagsRow tags={item.tags!} />}
    </>
  );
}

function ProductContent({ item, expanded }: { item: EconomyMarketCardProps['item']; expanded: boolean }) {
  const iconName: MaterialIconName = item.category
    ? (CATEGORY_ICON[item.category] ?? 'local-grocery-store')
    : 'local-grocery-store';

  return (
    <>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={[styles.categoryIconWrap, { backgroundColor: C.dopLight }]}>
          <MaterialIcons name={iconName} size={20} color={C.dop} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.itemName}>{item.name}</Text>
          {item.origin && (
            <View style={styles.locationRow}>
              <MaterialIcons name="location-on" size={12} color={C.textLight} />
              <Text style={styles.locationText}>{item.origin}</Text>
            </View>
          )}
        </View>
        {item.dop && (
          <View style={styles.dopBadge}>
            <Text style={styles.dopBadgeText}>DOP</Text>
          </View>
        )}
      </View>

      {/* Season dots */}
      {(item.season ?? []).length > 0 && <SeasonDots season={item.season!} />}

      {/* Story */}
      {item.story && (
        <Text style={styles.description} numberOfLines={expanded ? undefined : 2}>
          {item.story}
        </Text>
      )}
    </>
  );
}

// ─── Main Card ────────────────────────────────────────────────────────────────

export default function EconomyMarketCard({
  item,
  variant,
  expanded = false,
  onPress,
}: EconomyMarketCardProps) {
  const accentColor =
    variant === 'market'  ? C.market  :
    variant === 'artisan' ? C.artisan :
    C.dop;

  return (
    <View style={[styles.card, { shadowColor: accentColor }]}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={styles.inner}
      >
        {/* Left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

        <View style={styles.content}>
          {variant === 'market'  && <MarketContent  item={item} expanded={expanded} />}
          {variant === 'artisan' && <ArtisanContent item={item} expanded={expanded} />}
          {variant === 'product' && <ProductContent item={item} expanded={expanded} />}

          {/* Expand hint */}
          <View style={styles.expandHint}>
            <MaterialIcons
              name={expanded ? 'expand-less' : 'expand-more'}
              size={18}
              color={C.textLight}
            />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  inner: {
    flexDirection: 'row',
  },
  accentBar: {
    width: 4,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  titleBlock: {
    flex: 1,
    gap: 3,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textDark,
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  locationText: {
    fontSize: 11,
    color: C.textLight,
    fontWeight: '500',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    maxWidth: 130,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  scheduleText: {
    fontSize: 12,
    color: C.textMed,
    fontWeight: '500',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  description: {
    fontSize: 13,
    color: C.textMed,
    lineHeight: 19,
  },
  expandHint: {
    alignItems: 'flex-end',
    marginTop: -4,
  },
  categoryIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dopBadge: {
    backgroundColor: '#D97706',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  dopBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
});

const subStyles = StyleSheet.create({
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textMed,
    marginLeft: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  tagChip: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
    color: C.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  seasonRow: {
    flexDirection: 'row',
    gap: 3,
    flexWrap: 'wrap',
  },
  seasonDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seasonDotIn: {
    backgroundColor: C.dop,
  },
  seasonDotOut: {
    backgroundColor: C.border,
  },
  seasonDotCurrent: {
    borderWidth: 2,
    borderColor: C.accent,
  },
  seasonDotLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0,
  },
  seasonDotLabelIn: {
    color: '#FFFFFF',
  },
  seasonDotLabelOut: {
    color: C.textLight,
  },
});
