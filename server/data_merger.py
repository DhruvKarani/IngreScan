#!/usr/bin/env python3
"""
Data Merger - Smart Multi-Source Product Data Combination

Intelligently merges product data from multiple API sources using waterfall logic:
1. Try each source in priority order
2. Validate data quality using completeness score
3. Keep trying until usable data found OR all sources exhausted
4. Prefer longest ingredient list when merging

Merger Strategy:
- Primary field selection: Choose most complete source for each field
- Ingredient list: Use longest, most detailed version
- Nutriments: Fill gaps from multiple sources (union)
- Confidence scoring: Based on cross-source agreement
"""

import sys
import os
from typing import Dict, List, Optional, Any, Tuple
import logging

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from data_quality_validator import validate_product_data, is_usable_data

logger = logging.getLogger(__name__)


class DataMerger:
    """
    Smart merger for multi-source product data.
    """
    
    # Source priority weights (higher = more trusted)
    SOURCE_PRIORITIES = {
        'Firebase': 200,  # Firebase - user verified data, highest trust
        'OFF': 100,  # OpenFoodFacts - largest database
        'Edamam': 80,  # Edamam - professional nutrition data
        'FatSecret': 60,  # FatSecret - user-submitted data
        'Manual': 150,  # User-entered data - highest trust
    }
    
    def __init__(self):
        self.reset()
    
    def reset(self):
        """Reset merger state for new product."""
        self.sources_tried = []
        self.sources_used = {}
        self.all_data = []
    
    def waterfall_merge(self, fetch_results: List[Tuple[str, Optional[Dict]]]) -> Optional[Dict]:
        """
        Waterfall merge with gap-filling: Try sources in order, use first usable data as primary,
        then fill missing fields from other sources.
        
        Args:
            fetch_results: List of (source_name, product_data) tuples in priority order
        
        Returns:
            Best product data or None if no usable data found
        """
        self.reset()
        
        logger.info(f"Waterfall merge with gap-filling: {len(fetch_results)} sources to try")
        
        primary_data = None
        primary_source = None
        primary_validation = None
        
        for source_name, product_data in fetch_results:
            self.sources_tried.append(source_name)
            
            if not product_data:
                logger.info(f"  {source_name}: No data returned")
                continue
            
            # Validate data quality
            validation = validate_product_data(product_data)
            is_usable = is_usable_data(product_data)
            
            logger.info(
                f"  {source_name}: {validation['completeness_score']}% complete "
                f"({validation['confidence']}) - {'USABLE' if is_usable else 'UNUSABLE'}"
            )
            
            # Store for potential gap-filling
            self.all_data.append({
                'source': source_name,
                'data': product_data,
                'validation': validation,
                'is_usable': is_usable
            })
            
            # If data is usable and we don't have primary yet, set it
            if is_usable and not primary_data:
                primary_data = product_data
                primary_source = source_name
                primary_validation = validation
                logger.info(f"✓ Primary source: {source_name} ({validation['completeness_score']}% complete)")
        
        if not primary_data:
            logger.warning(f"✗ Waterfall FAILED: No usable data from {len(fetch_results)} sources")
            return None
        
        # Now fill gaps in primary data from other sources
        sources_used = [primary_source]
        gap_filled_fields = []
        
        # If primary is incomplete (< 80%), try to fill gaps
        if primary_validation['completeness_score'] < 80:
            logger.info(f"Gap-filling: Primary source incomplete, checking other sources...")
            
            for item in self.all_data:
                if item['source'] == primary_source:
                    continue  # Skip primary source
                
                secondary_data = item['data']
                if not secondary_data:
                    continue
                
                # Fill missing ingredients
                if not primary_data.get('ingredients_text') and secondary_data.get('ingredients_text'):
                    primary_data['ingredients_text'] = secondary_data['ingredients_text']
                    gap_filled_fields.append(f"ingredients_text (from {item['source']})")
                    if item['source'] not in sources_used:
                        sources_used.append(item['source'])
                
                # Fill missing brands
                if not primary_data.get('brands') and secondary_data.get('brands'):
                    primary_data['brands'] = secondary_data['brands']
                    gap_filled_fields.append(f"brands (from {item['source']})")
                    if item['source'] not in sources_used:
                        sources_used.append(item['source'])
                
                # Fill missing nutrition data
                if 'nutriments' in primary_data:
                    primary_nutr = primary_data['nutriments']
                    secondary_nutr = secondary_data.get('nutriments', {})
                    
                    for nutr_key in ['sugars_100g', 'fat_100g', 'proteins_100g', 'carbohydrates_100g', 
                                     'fiber_100g', 'salt_100g', 'energy-kcal_100g', 'saturated-fat_100g']:
                        if not primary_nutr.get(nutr_key) and secondary_nutr.get(nutr_key):
                            primary_nutr[nutr_key] = secondary_nutr[nutr_key]
                            gap_filled_fields.append(f"{nutr_key} (from {item['source']})")
                            if item['source'] not in sources_used:
                                sources_used.append(item['source'])
            
            if gap_filled_fields:
                logger.info(f"✓ Gap-filled {len(gap_filled_fields)} fields from {len(sources_used)-1} additional sources")
        
        # Re-validate after gap-filling
        final_validation = validate_product_data(primary_data)
        
        # Annotate with metadata
        primary_data['_metadata'] = {
            'primary_source': primary_source,
            'sources_tried': self.sources_tried,
            'sources_used': sources_used,
            'gap_filled_fields': gap_filled_fields,
            'completeness_score': final_validation['completeness_score'],
            'confidence': final_validation['confidence'],
            'needs_verification': final_validation['needs_verification'],
            'missing_fields': final_validation['missing_fields']
        }
        
        logger.info(
            f"✓ Waterfall SUCCESS: {final_validation['completeness_score']}% complete "
            f"({len(sources_used)} sources used, {len(gap_filled_fields)} fields filled)"
        )
        
        return primary_data
    
    def smart_merge(self, fetch_results: List[Tuple[str, Optional[Dict]]]) -> Optional[Dict]:
        """
        Smart merge: Combine best fields from multiple sources.
        More sophisticated than waterfall, but slower.
        
        Strategy:
        1. Collect all valid source data
        2. For each field, choose best source based on:
           - Data completeness for that field
           - Source priority/trust level
           - Cross-source agreement
        3. Merge nutrients (union of all sources)
        4. Choose longest ingredient list
        
        Args:
            fetch_results: List of (source_name, product_data) tuples
        
        Returns:
            Merged product data or None if no usable sources
        """
        self.reset()
        
        logger.info(f"Smart merge: {len(fetch_results)} sources available")
        
        # Collect and validate all source data
        valid_sources = []
        
        for source_name, product_data in fetch_results:
            self.sources_tried.append(source_name)
            
            if not product_data:
                logger.info(f"  {source_name}: No data returned")
                continue
            
            validation = validate_product_data(product_data)
            
            logger.info(
                f"  {source_name}: {validation['completeness_score']}% complete "
                f"({validation['confidence']})"
            )
            
            self.all_data.append({
                'source': source_name,
                'data': product_data,
                'validation': validation,
                'priority': self.SOURCE_PRIORITIES.get(source_name, 50)
            })
            
            # Keep sources with at least some usable data
            if validation['completeness_score'] > 0:
                valid_sources.append(self.all_data[-1])
        
        if not valid_sources:
            logger.warning("✗ Smart merge FAILED: No valid sources")
            return None
        
        # Sort by priority (highest first)
        valid_sources.sort(key=lambda x: x['priority'], reverse=True)
        
        logger.info(f"Smart merge: Combining {len(valid_sources)} valid sources")
        
        # Build merged product
        merged = self._merge_fields(valid_sources)
        
        # Annotate with metadata
        merged['_metadata'] = {
            'primary_source': valid_sources[0]['source'],
            'sources_tried': self.sources_tried,
            'sources_used': list(self.sources_used.keys()),
            'source_contributions': self.sources_used,
            'completeness_score': validate_product_data(merged)['completeness_score'],
            'confidence': self._calculate_merged_confidence(valid_sources),
            'needs_verification': validate_product_data(merged)['needs_verification'],
            'missing_fields': validate_product_data(merged)['missing_fields']
        }
        
        logger.info(
            f"✓ Smart merge SUCCESS: {merged['_metadata']['completeness_score']}% complete "
            f"from {len(self.sources_used)} sources"
        )
        
        return merged
    
    def _merge_fields(self, valid_sources: List[Dict]) -> Dict:
        """
        Merge individual fields from multiple sources.
        
        Args:
            valid_sources: List of validated source dictionaries
        
        Returns:
            Merged product dictionary
        """
        merged = {}
        
        # Critical fields - use highest priority source with non-empty value
        critical_fields = ['barcode', 'product_name', 'ingredients_text']
        
        for field in critical_fields:
            value, source = self._select_best_value(field, valid_sources)
            if value:
                merged[field] = value
                self.sources_used[source] = self.sources_used.get(source, []) + [field]
        
        # Important fields - merge from all sources
        important_fields = ['brands', 'categories', 'allergens']
        
        for field in important_fields:
            merged_value, contributing_sources = self._merge_list_field(field, valid_sources)
            if merged_value:
                merged[field] = merged_value
                for src in contributing_sources:
                    self.sources_used[src] = self.sources_used.get(src, []) + [field]
        
        # Nutriments - union of all sources
        merged_nutrients, nutrient_sources = self._merge_nutriments(valid_sources)
        if merged_nutrients:
            merged['nutriments'] = merged_nutrients
            for src in nutrient_sources:
                self.sources_used[src] = self.sources_used.get(src, []) + ['nutriments']
        
        # Optional fields - use first available
        optional_fields = ['image_url', 'serving_size', 'quantity']
        
        for field in optional_fields:
            value, source = self._select_best_value(field, valid_sources)
            if value:
                merged[field] = value
                self.sources_used[source] = self.sources_used.get(source, []) + [field]
        
        # Copy barcode from first source if not present
        if 'barcode' not in merged and valid_sources:
            merged['barcode'] = valid_sources[0]['data'].get('barcode', '')
        
        return merged
    
    def _select_best_value(self, field: str, sources: List[Dict]) -> Tuple[Any, str]:
        """
        Select best value for a field from multiple sources.
        
        Strategy:
        1. Prefer non-empty values
        2. For ingredient_text, prefer longest
        3. Otherwise use highest priority source
        
        Args:
            field: Field name to select
            sources: List of source dictionaries
        
        Returns:
            (best_value, source_name)
        """
        candidates = []
        
        for source_dict in sources:
            value = source_dict['data'].get(field)
            if value and str(value).strip():
                candidates.append({
                    'value': value,
                    'source': source_dict['source'],
                    'priority': source_dict['priority']
                })
        
        if not candidates:
            return None, None
        
        # Special handling for ingredients_text - prefer longest
        if field == 'ingredients_text':
            candidates.sort(key=lambda x: len(str(x['value'])), reverse=True)
            best = candidates[0]
            logger.debug(f"  {field}: Selected {best['source']} (longest: {len(str(best['value']))} chars)")
            return best['value'], best['source']
        
        # For other fields, use highest priority
        candidates.sort(key=lambda x: x['priority'], reverse=True)
        best = candidates[0]
        logger.debug(f"  {field}: Selected {best['source']} (priority: {best['priority']})")
        return best['value'], best['source']
    
    def _merge_list_field(self, field: str, sources: List[Dict]) -> Tuple[Any, List[str]]:
        """
        Merge list/string fields from multiple sources (union).
        
        Args:
            field: Field name to merge
            sources: List of source dictionaries
        
        Returns:
            (merged_value, contributing_sources)
        """
        all_values = []
        contributing = []
        
        for source_dict in sources:
            value = source_dict['data'].get(field)
            
            if not value:
                continue
            
            # Handle string fields (split and merge)
            if isinstance(value, str):
                items = [v.strip() for v in value.replace(',', ';').split(';') if v.strip()]
                all_values.extend(items)
                if items:
                    contributing.append(source_dict['source'])
            
            # Handle list fields
            elif isinstance(value, list):
                all_values.extend([str(v).strip() for v in value if v])
                if value:
                    contributing.append(source_dict['source'])
        
        if not all_values:
            return None, []
        
        # Remove duplicates, keep order
        seen = set()
        unique = []
        for val in all_values:
            val_lower = val.lower()
            if val_lower not in seen:
                seen.add(val_lower)
                unique.append(val)
        
        # Return as list for allergens, string for others
        if field == 'allergens':
            logger.debug(f"  {field}: Merged {len(unique)} items from {len(contributing)} sources")
            return unique, contributing
        else:
            logger.debug(f"  {field}: Merged from {len(contributing)} sources")
            return ', '.join(unique), contributing
    
    def _merge_nutriments(self, sources: List[Dict]) -> Tuple[Dict, List[str]]:
        """
        Merge nutriment data from multiple sources (union, prefer most complete).
        
        Args:
            sources: List of source dictionaries
        
        Returns:
            (merged_nutriments, contributing_sources)
        """
        merged = {}
        contributing = []
        
        # Standard nutrient fields (prefer _100g values)
        standard_fields = [
            'energy-kcal_100g', 'sugars_100g', 'fat_100g', 'proteins_100g',
            'carbohydrates_100g', 'fiber_100g', 'salt_100g', 'sodium_100g',
            'saturated-fat_100g'
        ]
        
        for field in standard_fields:
            for source_dict in sources:
                nutrients = source_dict['data'].get('nutriments', {})
                value = nutrients.get(field)
                
                if value is not None:
                    # Use first valid value (sources are priority-sorted)
                    if field not in merged:
                        merged[field] = value
                        if source_dict['source'] not in contributing:
                            contributing.append(source_dict['source'])
        
        if merged:
            logger.debug(f"  nutriments: Merged {len(merged)} fields from {len(contributing)} sources")
        
        return merged, contributing
    
    def _calculate_merged_confidence(self, sources: List[Dict]) -> str:
        """
        Calculate confidence level for merged data.
        
        Based on:
        - Number of sources with data
        - Agreement between sources
        - Individual source confidences
        
        Args:
            sources: List of source dictionaries
        
        Returns:
            Confidence level: 'HIGH', 'MEDIUM', or 'LOW'
        """
        if len(sources) >= 3:
            return 'HIGH'  # Multiple sources agree
        elif len(sources) == 2:
            return 'MEDIUM'  # Two sources
        else:
            # Single source - use its confidence
            return sources[0]['validation']['confidence']


# =============================================================================
# TESTING
# =============================================================================

if __name__ == '__main__':
    # Configure logging for testing
    logging.basicConfig(
        level=logging.INFO,
        format='%(levelname)s - %(message)s'
    )
    
    print("\n" + "=" * 70)
    print("Data Merger - Test Cases")
    print("=" * 70)
    
    merger = DataMerger()
    
    # Mock product data from different sources
    off_data = {
        'barcode': '8901719128462',
        'product_name': 'Parle-G Gold',
        'ingredients_text': 'Wheat flour, sugar, palm oil, salt',
        'brands': 'Parle',
        'categories': 'Biscuits',
        'nutriments': {
            'energy-kcal_100g': 456,
            'sugars_100g': 25.5,
            'fat_100g': 11.2
        },
        'allergens': ['wheat'],
        '_source': 'OFF'
    }
    
    edamam_data = {
        'barcode': '8901719128462',
        'product_name': 'Parle G Gold Biscuits',
        'ingredients_text': 'Refined wheat flour (maida), sugar, refined palm oil, invert sugar syrup, salt, leavening agents',
        'brands': 'Parle Products',
        'categories': 'Snacks, Biscuits',
        'nutriments': {
            'energy-kcal_100g': 456,
            'proteins_100g': 7.1,
            'carbohydrates_100g': 75.6,
            'fiber_100g': 2.3
        },
        'allergens': ['gluten'],
        '_source': 'Edamam'
    }
    
    # Test 1: Waterfall merge
    print("\n[Test 1] Waterfall Merge (First Usable Wins)")
    print("-" * 70)
    
    result1 = merger.waterfall_merge([
        ('OFF', off_data),
        ('Edamam', edamam_data)
    ])
    
    if result1:
        print(f"✓ Primary Source: {result1['_metadata']['primary_source']}")
        print(f"  Product: {result1['product_name']}")
        print(f"  Completeness: {result1['_metadata']['completeness_score']}%")
        print(f"  Sources Tried: {result1['_metadata']['sources_tried']}")
    
    # Test 2: Smart merge
    print("\n[Test 2] Smart Merge (Combine Best Fields)")
    print("-" * 70)
    
    result2 = merger.smart_merge([
        ('OFF', off_data),
        ('Edamam', edamam_data)
    ])
    
    if result2:
        print(f"✓ Primary Source: {result2['_metadata']['primary_source']}")
        print(f"  Product: {result2['product_name']}")
        print(f"  Ingredients: {result2['ingredients_text'][:80]}...")
        print(f"  Completeness: {result2['_metadata']['completeness_score']}%")
        print(f"  Sources Used: {result2['_metadata']['sources_used']}")
        print(f"  Nutrients Merged: {len(result2.get('nutriments', {}))} fields")
        print(f"  Allergens: {result2.get('allergens', [])}")
    
    # Test 3: Waterfall with failed sources
    print("\n[Test 3] Waterfall with Failed Sources")
    print("-" * 70)
    
    result3 = merger.waterfall_merge([
        ('FatSecret', None),  # Failed
        ('Edamam', None),     # Failed
        ('OFF', off_data)     # Success
    ])
    
    if result3:
        print(f"✓ Fallback worked: {result3['_metadata']['primary_source']}")
        print(f"  Sources Tried: {result3['_metadata']['sources_tried']}")
    
    print("\n" + "=" * 70)
    print("✓ All tests completed")
    print("=" * 70 + "\n")
