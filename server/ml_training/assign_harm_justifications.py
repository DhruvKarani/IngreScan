"""
Step 3: Assign Harm Level Justifications with Scientific Sources

Adds detailed citations, regulatory status, and scientific references
for each ingredient's harm level classification.

Input: classified_ingredients.csv
Output: ingredients_with_harm_levels.csv
"""

import pandas as pd
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class HarmJustificationEngine:
    """Generate harm level justifications with scientific sources"""
    
    def __init__(self):
        # Ingredient-specific knowledge base
        self.ingredient_knowledge = {
            # Artificial Sweeteners
            'E950': {
                'justification': 'Acesulfame K approved by EFSA with ADI of 9 mg/kg/day. Some studies suggest potential gut microbiome effects.',
                'references': 'EFSA Journal 2000;1800, FDA GRAS Notice GRN 000037',
                'regulatory_status': 'Approved: EU, US, Canada'
            },
            'E951': {
                'justification': 'Aspartame approved but controversial. EFSA confirmed ADI of 40 mg/kg/day. Contains phenylalanine (warning for PKU patients). Linked to headaches in sensitive individuals.',
                'references': 'EFSA Journal 2013;11(12):3496, FDA Approved 1981',
                'regulatory_status': 'Approved: EU, US, Canada; Warning: PKU patients'
            },
            'E952': {
                'justification': 'Cyclamate banned in US since 1969 due to animal cancer studies. Still approved in EU with ADI 7 mg/kg/day.',
                'references': 'EFSA Journal 2017;15(12):5059, FDA Banned 1969',
                'regulatory_status': 'Banned: US; Approved: EU, Canada'
            },
            'E954': {
                'justification': 'Saccharin oldest artificial sweetener. Removed from US carcinogen list in 2000. EFSA ADI 5 mg/kg/day.',
                'references': 'EFSA Journal 2017;15(3):4699, FDA Delisted 2000',
                'regulatory_status': 'Approved: EU, US, Canada'
            },
            'E955': {
                'justification': 'Sucralose approved with ADI 15 mg/kg/day. Studies show minimal absorption. Some research suggests effects on insulin response.',
                'references': 'EFSA Journal 2017;15(12):5063, FDA GRAS Notice GRN 000064',
                'regulatory_status': 'Approved: EU, US, Canada'
            },
            
            # Natural Sweeteners
            'E960': {
                'justification': 'Steviol glycosides (stevia) from plant source. EFSA ADI 4 mg/kg/day. Generally recognized as safe, natural origin.',
                'references': 'EFSA Journal 2010;8(4):1537, FDA GRAS 2008',
                'regulatory_status': 'Approved: EU, US, Canada'
            },
            'E957': {
                'justification': 'Thaumatin natural protein sweetener from katemfe fruit. EFSA no ADI needed (safe). Used in small quantities.',
                'references': 'EFSA Journal 2015;13(11):4290',
                'regulatory_status': 'Approved: EU, US, Canada'
            },
            
            # Preservatives - Benzoates
            'E210': {
                'justification': 'Benzoic acid approved but can form benzene when combined with vitamin C. Linked to hyperactivity in children (Southampton Study). EFSA ADI 5 mg/kg/day.',
                'references': 'EFSA Journal 2016;14(3):4433, McCann 2007 (Lancet 370:1560)',
                'regulatory_status': 'Approved: EU, US, Canada; Restricted in some products'
            },
            'E211': {
                'justification': 'Sodium benzoate can form carcinogenic benzene with ascorbic acid. Associated with hyperactivity. EFSA reviewing safety.',
                'references': 'EFSA Journal 2016;14(3):4433, FDA Warning 2006',
                'regulatory_status': 'Approved: EU, US, Canada; Controversial'
            },
            'E212': {
                'justification': 'Potassium benzoate similar concerns to E211. Can trigger allergic reactions in sensitive individuals.',
                'references': 'EFSA Journal 2016;14(3):4433',
                'regulatory_status': 'Approved: EU, US, Canada'
            },
            'E213': {
                'justification': 'Calcium benzoate shares benzoate family concerns. Less commonly used than sodium form.',
                'references': 'EFSA Journal 2016;14(3):4433',
                'regulatory_status': 'Approved: EU, US, Canada'
            },
            
            # Preservatives - Sulfites
            'E220': {
                'justification': 'Sulfur dioxide potent preservative. Can trigger severe asthma attacks. Destroys vitamin B1. EFSA ADI 0.7 mg/kg/day.',
                'references': 'EFSA Journal 2016;14(4):4438, FDA Mandatory labeling',
                'regulatory_status': 'Approved: EU, US, Canada; Mandatory allergen warning'
            },
            'E221': {
                'justification': 'Sodium sulfite causes allergic reactions, particularly in asthmatics. FDA requires labeling >10ppm.',
                'references': 'EFSA Journal 2016;14(4):4438, FDA 21 CFR 182.3637',
                'regulatory_status': 'Approved: EU, US, Canada; Allergen warning required'
            },
            'E223': {
                'justification': 'Sodium metabisulfite strong allergen for asthmatics. Can cause hives, breathing difficulties.',
                'references': 'EFSA Journal 2016;14(4):4438',
                'regulatory_status': 'Approved: EU, US, Canada; Allergen warning'
            },
            
            # Preservatives - Nitrites/Nitrates
            'E249': {
                'justification': 'Potassium nitrite can form carcinogenic nitrosamines in meat. IARC Group 2A (probably carcinogenic). EFSA lowered ADI to 0.07 mg/kg/day.',
                'references': 'EFSA Journal 2017;15(6):4786, IARC Monograph 94',
                'regulatory_status': 'Approved: EU, US, Canada; Restricted quantities; Cancer link'
            },
            'E250': {
                'justification': 'Sodium nitrite forms nitrosamines when heated with proteins. Linked to colorectal cancer. Essential for botulism prevention in cured meats.',
                'references': 'EFSA Journal 2017;15(6):4786, IARC Group 2A',
                'regulatory_status': 'Approved: EU, US, Canada; Cancer warning; Max 150ppm'
            },
            'E251': {
                'justification': 'Sodium nitrate converts to nitrite in body. Associated with increased cancer risk in processed meats.',
                'references': 'EFSA Journal 2017;15(6):4786, WHO/IARC 2015',
                'regulatory_status': 'Approved: EU, US, Canada; Restricted use'
            },
            'E252': {
                'justification': 'Potassium nitrate similar concerns to E251. Restricted to cheese and cured meat.',
                'references': 'EFSA Journal 2017;15(6):4786',
                'regulatory_status': 'Approved: EU, US, Canada; Limited applications'
            },
            
            # Antioxidants - Synthetic
            'E310': {
                'justification': 'Propyl gallate potential endocrine disruptor. Banned in infant foods. Some countries restricting use.',
                'references': 'EFSA Journal 2014;12(4):3642, EWG Score: 7/10',
                'regulatory_status': 'Approved: EU, US; Banned: infant products; Under review'
            },
            'E319': {
                'justification': 'TBHQ (tert-Butylhydroquinone) synthetic antioxidant. Studies link to immune system effects, possible carcinogen. EFSA ADI 0.7 mg/kg/day.',
                'references': 'EFSA Journal 2016;14(7):4523, FDA 21 CFR 172.185',
                'regulatory_status': 'Approved: EU, US; Not approved: Japan, Canada (debate)'
            },
            'E320': {
                'justification': 'BHA (Butylated hydroxyanisole) classified as possible human carcinogen (IARC 2B). Banned in some countries. Can cause allergic reactions.',
                'references': 'EFSA Journal 2011;9(10):2392, IARC Group 2B',
                'regulatory_status': 'Approved: EU, US; Banned: Japan, Australia (parts)'
            },
            'E321': {
                'justification': 'BHT (Butylated hydroxytoluene) potential endocrine disruptor. Studies show conflicting results on carcinogenicity. EFSA re-evaluating.',
                'references': 'EFSA Journal 2012;10(3):2588, EWG Score: 5/10',
                'regulatory_status': 'Approved: EU, US, Canada; Under review'
            },
            
            # Colors - Azo Dyes
            'E102': {
                'justification': 'Tartrazine linked to hyperactivity in children (Southampton Study). Can trigger asthma, hives. Requires warning label in EU.',
                'references': 'McCann 2007 (Lancet 370:1560), EFSA Journal 2009;7(11):1331',
                'regulatory_status': 'Approved: EU (warning required), US, Canada; Banned: Norway'
            },
            'E110': {
                'justification': 'Sunset Yellow FCF azo dye linked to hyperactivity (ADHD symptoms). EU requires "may have adverse effect on activity and attention in children" warning.',
                'references': 'McCann 2007, EFSA Journal 2009;7(5):1330',
                'regulatory_status': 'Approved: EU (warning), US, Canada; Banned: Norway, Finland'
            },
            'E122': {
                'justification': 'Carmoisine/Azorubine azo dye. Southampton Study participant. Associated with hyperactivity. Allergic reactions reported.',
                'references': 'McCann 2007, EFSA Journal 2009;7(11):1332',
                'regulatory_status': 'Approved: EU (warning); Banned: US, Canada, Japan, Norway'
            },
            'E123': {
                'justification': 'Amaranth red dye banned in US since 1976 due to cancer concerns in animal studies. Still used in EU with restrictions.',
                'references': 'FDA Banned 1976, EFSA Journal 2010;8(7):1649',
                'regulatory_status': 'Banned: US, Russia; Approved: EU (restricted), Canada'
            },
            'E124': {
                'justification': 'Ponceau 4R/Cochineal Red A azo dye. Linked to hyperactivity. Can cause allergic reactions including anaphylaxis.',
                'references': 'McCann 2007, EFSA Journal 2009;7(11):1328',
                'regulatory_status': 'Approved: EU (warning); Banned: US, Norway'
            },
            'E127': {
                'justification': 'Erythrosine potential thyroid disruptor. Banned in cosmetics in EU. Studies show effects on thyroid hormones in rats.',
                'references': 'EFSA Journal 2011;9(1):1854, FDA 21 CFR 74.1240',
                'regulatory_status': 'Approved: US, Canada; Restricted: EU (limited use); Banned: Norway'
            },
            'E129': {
                'justification': 'Allura Red AC azo dye. Southampton Study linked to hyperactivity. May exacerbate ADHD symptoms.',
                'references': 'McCann 2007, EFSA Journal 2009;7(11):1327',
                'regulatory_status': 'Approved: EU (warning), US, Canada; Banned: Denmark, Belgium (debate)'
            },
            
            # Natural Colors
            'E120': {
                'justification': 'Carmine/Cochineal from insects. Natural but can cause severe allergic reactions. Some ethical concerns (insects).',
                'references': 'EFSA Journal 2015;13(11):4288, FDA Mandatory labeling',
                'regulatory_status': 'Approved: EU, US, Canada; Allergen warning required'
            },
            'E100': {
                'justification': 'Curcumin from turmeric. Natural, anti-inflammatory properties. EFSA ADI 3 mg/kg/day. Generally safe.',
                'references': 'EFSA Journal 2010;8(9):1679, FDA GRAS',
                'regulatory_status': 'Approved: EU, US, Canada; Generally safe'
            },
            
            # Flavor Enhancers
            'E621': {
                'justification': 'MSG (Monosodium glutamate) controversial. FDA GRAS but some report "Chinese Restaurant Syndrome" (headaches, flushing). EFSA no ADI needed.',
                'references': 'EFSA Journal 2017;15(7):4910, FDA GRAS SCOGS Report 1980',
                'regulatory_status': 'Approved: EU, US, Canada; Mandatory labeling'
            },
            'E635': {
                'justification': 'Disodium 5\'-ribonucleotides flavor enhancer. Contains guanylate and inosinate. May trigger gout in susceptible individuals.',
                'references': 'EFSA Journal 2014;12(2):3604',
                'regulatory_status': 'Approved: EU, US, Canada; Caution: gout patients'
            },
        }
        
        # Category-level default justifications
        self.category_defaults = {
            'artificial_sweetener': {
                'justification': 'Artificial sweetener with regulatory approval. Potential effects on gut microbiome and metabolism under research.',
                'references': 'EFSA/FDA approved',
                'regulatory_status': 'Approved: EU, US, Canada'
            },
            'natural_sweetener': {
                'justification': 'Natural-origin sweetener. Generally recognized as safe with established ADI.',
                'references': 'EFSA/FDA GRAS status',
                'regulatory_status': 'Approved: EU, US, Canada'
            },
            'sugar_alcohol': {
                'justification': 'Sugar alcohol approved as sweetener. Can cause digestive discomfort (laxative effect) in large amounts.',
                'references': 'EFSA/FDA approved with warnings',
                'regulatory_status': 'Approved: EU, US, Canada; Laxative warning required'
            },
            'refined_sugar': {
                'justification': 'Refined sugar. GRAS but linked to obesity, diabetes, cardiovascular disease when consumed in excess.',
                'references': 'WHO recommends <10% daily calories, FDA GRAS',
                'regulatory_status': 'Approved: worldwide; Health warnings in some countries'
            },
            'natural_sugar': {
                'justification': 'Natural sugar source. Contains some micronutrients but still high glycemic impact.',
                'references': 'FDA GRAS, WHO sugar guidelines apply',
                'regulatory_status': 'Approved: worldwide'
            },
            'natural_preservative': {
                'justification': 'Natural preservative, generally safe with low toxicity. EFSA approved with ADI or no ADI needed.',
                'references': 'EFSA/FDA GRAS',
                'regulatory_status': 'Approved: EU, US, Canada'
            },
            'moderate_preservative': {
                'justification': 'Approved preservative with established ADI. Generally well-tolerated but some sensitivity reported.',
                'references': 'EFSA/FDA approved with ADI',
                'regulatory_status': 'Approved: EU, US, Canada'
            },
            'harmful_preservative': {
                'justification': 'Preservative with safety concerns. May cause allergic reactions or linked to health issues in studies. Use restricted in some applications.',
                'references': 'EFSA under review, FDA approved with limitations',
                'regulatory_status': 'Approved: EU, US, Canada; Restrictions apply'
            },
            'very_harmful_preservative': {
                'justification': 'Significant safety concerns. Linked to cancer formation (nitrosamines) or severe allergic reactions. Restricted quantities.',
                'references': 'IARC classification, EFSA restricted ADI',
                'regulatory_status': 'Approved: limited use; Cancer warnings'
            },
            'natural_color': {
                'justification': 'Natural color additive from plant/mineral sources. Generally safe, some may cause allergies.',
                'references': 'EFSA/FDA approved',
                'regulatory_status': 'Approved: EU, US, Canada'
            },
            'moderate_color': {
                'justification': 'Color additive with acceptable safety profile but some processing concerns.',
                'references': 'EFSA/FDA approved with ADI',
                'regulatory_status': 'Approved: EU, US, Canada'
            },
            'harmful_color': {
                'justification': 'Synthetic azo dye linked to hyperactivity in children (Southampton Study). EU requires warning label. Allergic reactions reported.',
                'references': 'McCann 2007 (Lancet), EFSA re-evaluation',
                'regulatory_status': 'Approved: EU (warning required); Some banned in Norway, US'
            },
            'flavor_enhancer': {
                'justification': 'Flavor enhancer approved by regulators. Some consumers report sensitivity symptoms.',
                'references': 'EFSA/FDA approved',
                'regulatory_status': 'Approved: EU, US, Canada; Labeling required'
            },
            'emulsifier_stabilizer': {
                'justification': 'Emulsifier/stabilizer approved for food use. Generally safe in approved quantities.',
                'references': 'EFSA/FDA GRAS or approved additive',
                'regulatory_status': 'Approved: EU, US, Canada'
            },
            'fat': {
                'justification': 'Dietary fat. Health impact depends on type (saturated vs unsaturated) and quantity.',
                'references': 'FDA GRAS, WHO dietary guidelines',
                'regulatory_status': 'Approved: worldwide'
            },
            'acid': {
                'justification': 'Food acid used for flavor, preservation, pH control. Generally safe.',
                'references': 'EFSA/FDA GRAS',
                'regulatory_status': 'Approved: EU, US, Canada'
            },
            'leavening_agent': {
                'justification': 'Leavening agent used in baking. Generally recognized as safe.',
                'references': 'FDA GRAS',
                'regulatory_status': 'Approved: worldwide'
            },
            'thickener': {
                'justification': 'Thickening agent approved for food use. Generally safe.',
                'references': 'EFSA/FDA approved',
                'regulatory_status': 'Approved: EU, US, Canada'
            },
            'other': {
                'justification': 'Approved food additive or ingredient. Safety profile varies by specific substance.',
                'references': 'EFSA/FDA approved or GRAS',
                'regulatory_status': 'Approved: varies by ingredient'
            }
        }
    
    def get_justification(self, ingredient_name: str, e_number: str, our_category: str, harm_level: str) -> dict:
        """Get harm justification, references, and regulatory status"""
        
        # Try E-number specific knowledge first
        if e_number and e_number in self.ingredient_knowledge:
            return self.ingredient_knowledge[e_number]
        
        # Try category default
        if our_category in self.category_defaults:
            return self.category_defaults[our_category]
        
        # Ultimate fallback
        return {
            'justification': f'Food additive classified in {our_category} category. Approved for use with standard safety profile.',
            'references': 'EFSA/FDA regulatory approval',
            'regulatory_status': 'Approved: EU, US, Canada'
        }


def main():
    """Main execution function"""
    logger.info("=" * 60)
    logger.info("STEP 3: ASSIGN HARM LEVEL JUSTIFICATIONS")
    logger.info("=" * 60)
    
    # Load classified data from Step 2
    logger.info("\n[1/3] Loading classified ingredients...")
    df = pd.read_csv('classified_ingredients.csv')
    logger.info(f"✓ Loaded {len(df)} ingredients")
    
    # Initialize justification engine
    engine = HarmJustificationEngine()
    
    # Add justifications
    logger.info("\n[2/3] Adding harm justifications and scientific sources...")
    
    justifications = []
    references = []
    regulatory_statuses = []
    
    for idx, row in df.iterrows():
        result = engine.get_justification(
            row['ingredient_name'],
            row['e_number'],
            row['our_category'],
            row['harm_level']
        )
        
        justifications.append(result['justification'])
        references.append(result['references'])
        regulatory_statuses.append(result['regulatory_status'])
        
        if (idx + 1) % 50 == 0:
            logger.info(f"  Processed {idx + 1}/{len(df)} ingredients...")
    
    # Add new columns
    df['harm_justification'] = justifications
    df['scientific_references'] = references
    df['regulatory_status'] = regulatory_statuses
    
    # Save to CSV
    logger.info("\n[3/3] Saving data with harm justifications...")
    output_path = 'ingredients_with_harm_levels.csv'
    df.to_csv(output_path, index=False, encoding='utf-8')
    
    # Print summary
    logger.info("\n" + "=" * 60)
    logger.info("HARM JUSTIFICATION ASSIGNMENT COMPLETE")
    logger.info("=" * 60)
    logger.info(f"Total ingredients: {len(df)}")
    logger.info(f"Output saved to: {output_path}")
    
    logger.info("\nColumns added:")
    logger.info("  - harm_justification: Detailed explanation of harm level")
    logger.info("  - scientific_references: EFSA/FDA/IARC citations")
    logger.info("  - regulatory_status: Approval/ban status by country")
    
    logger.info("\nSample entries with justifications:")
    sample = df[['ingredient_name', 'e_number', 'our_category', 'harm_level', 
                 'harm_justification', 'scientific_references']].head(10)
    print("\n" + sample.to_string(max_colwidth=60))
    
    # Statistics
    logger.info(f"\n✓ Ingredients with specific E-number justifications: {len([e for e in df['e_number'] if e in engine.ingredient_knowledge])}")
    logger.info(f"✓ Ingredients with category-level justifications: {len(df) - len([e for e in df['e_number'] if e in engine.ingredient_knowledge])}")
    
    logger.info("\n✓ Step 3 Complete! Next: Step 4 - Augment with crowdsourced Firebase data")


if __name__ == "__main__":
    main()
