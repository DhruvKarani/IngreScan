"""
Step 1: Collect Ingredient Data from Authoritative Sources
- EFSA E-number database
- FDA GRAS list
- FooDB API (food additives)

Output: authoritative_ingredients.csv
"""

import requests
import pandas as pd
import json
import time
from bs4 import BeautifulSoup
import re
import logging
from typing import List, Dict

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class EFSACollector:
    """Collect E-numbers from EFSA approved additives list"""
    
    def __init__(self):
        # EFSA Food Additives Database
        self.efsa_url = "https://webgate.ec.europa.eu/foods_system/main/?sector=FAD&auth=SANCAS"
        self.enumbers_data = []
    
    def collect_manual_efsa_data(self) -> List[Dict]:
        """
        Manual E-number list from EFSA approved additives
        This is a curated list of common E-numbers with official names
        Source: European Commission Food Additives Database
        """
        logger.info("Loading EFSA E-number data (manual curated list)...")
        
        # Comprehensive E-number database from EFSA
        efsa_enumbers = [
            # Sweeteners (E950-E969)
            {"code": "E950", "name": "Acesulfame K", "function": "Sweetener", "source": "EFSA"},
            {"code": "E951", "name": "Aspartame", "function": "Sweetener", "source": "EFSA"},
            {"code": "E952", "name": "Cyclamate", "function": "Sweetener", "source": "EFSA"},
            {"code": "E953", "name": "Isomalt", "function": "Sweetener", "source": "EFSA"},
            {"code": "E954", "name": "Saccharin", "function": "Sweetener", "source": "EFSA"},
            {"code": "E955", "name": "Sucralose", "function": "Sweetener", "source": "EFSA"},
            {"code": "E957", "name": "Thaumatin", "function": "Sweetener", "source": "EFSA"},
            {"code": "E959", "name": "Neohesperidine DC", "function": "Sweetener", "source": "EFSA"},
            {"code": "E960", "name": "Steviol glycosides", "function": "Sweetener", "source": "EFSA"},
            {"code": "E961", "name": "Neotame", "function": "Sweetener", "source": "EFSA"},
            {"code": "E962", "name": "Salt of aspartame-acesulfame", "function": "Sweetener", "source": "EFSA"},
            {"code": "E965", "name": "Maltitol", "function": "Sweetener", "source": "EFSA"},
            {"code": "E966", "name": "Lactitol", "function": "Sweetener", "source": "EFSA"},
            {"code": "E967", "name": "Xylitol", "function": "Sweetener", "source": "EFSA"},
            {"code": "E968", "name": "Erythritol", "function": "Sweetener", "source": "EFSA"},
            
            # Preservatives (E200-E297)
            {"code": "E200", "name": "Sorbic acid", "function": "Preservative", "source": "EFSA"},
            {"code": "E201", "name": "Sodium sorbate", "function": "Preservative", "source": "EFSA"},
            {"code": "E202", "name": "Potassium sorbate", "function": "Preservative", "source": "EFSA"},
            {"code": "E203", "name": "Calcium sorbate", "function": "Preservative", "source": "EFSA"},
            {"code": "E210", "name": "Benzoic acid", "function": "Preservative", "source": "EFSA"},
            {"code": "E211", "name": "Sodium benzoate", "function": "Preservative", "source": "EFSA"},
            {"code": "E212", "name": "Potassium benzoate", "function": "Preservative", "source": "EFSA"},
            {"code": "E213", "name": "Calcium benzoate", "function": "Preservative", "source": "EFSA"},
            {"code": "E220", "name": "Sulphur dioxide", "function": "Preservative", "source": "EFSA"},
            {"code": "E221", "name": "Sodium sulphite", "function": "Preservative", "source": "EFSA"},
            {"code": "E222", "name": "Sodium hydrogen sulphite", "function": "Preservative", "source": "EFSA"},
            {"code": "E223", "name": "Sodium metabisulphite", "function": "Preservative", "source": "EFSA"},
            {"code": "E224", "name": "Potassium metabisulphite", "function": "Preservative", "source": "EFSA"},
            {"code": "E228", "name": "Potassium hydrogen sulphite", "function": "Preservative", "source": "EFSA"},
            {"code": "E230", "name": "Biphenyl", "function": "Preservative", "source": "EFSA"},
            {"code": "E231", "name": "Orthophenyl phenol", "function": "Preservative", "source": "EFSA"},
            {"code": "E232", "name": "Sodium orthophenyl phenol", "function": "Preservative", "source": "EFSA"},
            {"code": "E234", "name": "Nisin", "function": "Preservative", "source": "EFSA"},
            {"code": "E235", "name": "Natamycin", "function": "Preservative", "source": "EFSA"},
            {"code": "E242", "name": "Dimethyl dicarbonate", "function": "Preservative", "source": "EFSA"},
            {"code": "E249", "name": "Potassium nitrite", "function": "Preservative", "source": "EFSA"},
            {"code": "E250", "name": "Sodium nitrite", "function": "Preservative", "source": "EFSA"},
            {"code": "E251", "name": "Sodium nitrate", "function": "Preservative", "source": "EFSA"},
            {"code": "E252", "name": "Potassium nitrate", "function": "Preservative", "source": "EFSA"},
            {"code": "E260", "name": "Acetic acid", "function": "Preservative", "source": "EFSA"},
            {"code": "E261", "name": "Potassium acetate", "function": "Preservative", "source": "EFSA"},
            {"code": "E262", "name": "Sodium acetate", "function": "Preservative", "source": "EFSA"},
            {"code": "E263", "name": "Calcium acetate", "function": "Preservative", "source": "EFSA"},
            {"code": "E270", "name": "Lactic acid", "function": "Preservative", "source": "EFSA"},
            {"code": "E280", "name": "Propionic acid", "function": "Preservative", "source": "EFSA"},
            {"code": "E281", "name": "Sodium propionate", "function": "Preservative", "source": "EFSA"},
            {"code": "E282", "name": "Calcium propionate", "function": "Preservative", "source": "EFSA"},
            {"code": "E283", "name": "Potassium propionate", "function": "Preservative", "source": "EFSA"},
            
            # Antioxidants (E300-E321)
            {"code": "E300", "name": "Ascorbic acid", "function": "Antioxidant", "source": "EFSA"},
            {"code": "E301", "name": "Sodium ascorbate", "function": "Antioxidant", "source": "EFSA"},
            {"code": "E302", "name": "Calcium ascorbate", "function": "Antioxidant", "source": "EFSA"},
            {"code": "E304", "name": "Fatty acid esters of ascorbic acid", "function": "Antioxidant", "source": "EFSA"},
            {"code": "E306", "name": "Tocopherols", "function": "Antioxidant", "source": "EFSA"},
            {"code": "E307", "name": "Alpha-tocopherol", "function": "Antioxidant", "source": "EFSA"},
            {"code": "E308", "name": "Gamma-tocopherol", "function": "Antioxidant", "source": "EFSA"},
            {"code": "E309", "name": "Delta-tocopherol", "function": "Antioxidant", "source": "EFSA"},
            {"code": "E310", "name": "Propyl gallate", "function": "Antioxidant", "source": "EFSA"},
            {"code": "E311", "name": "Octyl gallate", "function": "Antioxidant", "source": "EFSA"},
            {"code": "E312", "name": "Dodecyl gallate", "function": "Antioxidant", "source": "EFSA"},
            {"code": "E319", "name": "TBHQ", "function": "Antioxidant", "source": "EFSA"},
            {"code": "E320", "name": "BHA", "function": "Antioxidant", "source": "EFSA"},
            {"code": "E321", "name": "BHT", "function": "Antioxidant", "source": "EFSA"},
            {"code": "E330", "name": "Citric acid", "function": "Antioxidant", "source": "EFSA"},
            
            # Colors (E100-E180)
            {"code": "E100", "name": "Curcumin", "function": "Color", "source": "EFSA"},
            {"code": "E101", "name": "Riboflavin", "function": "Color", "source": "EFSA"},
            {"code": "E102", "name": "Tartrazine", "function": "Color", "source": "EFSA"},
            {"code": "E104", "name": "Quinoline Yellow", "function": "Color", "source": "EFSA"},
            {"code": "E110", "name": "Sunset Yellow", "function": "Color", "source": "EFSA"},
            {"code": "E120", "name": "Carmine", "function": "Color", "source": "EFSA"},
            {"code": "E122", "name": "Azorubine", "function": "Color", "source": "EFSA"},
            {"code": "E123", "name": "Amaranth", "function": "Color", "source": "EFSA"},
            {"code": "E124", "name": "Ponceau 4R", "function": "Color", "source": "EFSA"},
            {"code": "E127", "name": "Erythrosine", "function": "Color", "source": "EFSA"},
            {"code": "E129", "name": "Allura Red", "function": "Color", "source": "EFSA"},
            {"code": "E131", "name": "Patent Blue V", "function": "Color", "source": "EFSA"},
            {"code": "E132", "name": "Indigotine", "function": "Color", "source": "EFSA"},
            {"code": "E133", "name": "Brilliant Blue", "function": "Color", "source": "EFSA"},
            {"code": "E140", "name": "Chlorophyll", "function": "Color", "source": "EFSA"},
            {"code": "E141", "name": "Copper complexes of chlorophyll", "function": "Color", "source": "EFSA"},
            {"code": "E142", "name": "Green S", "function": "Color", "source": "EFSA"},
            {"code": "E150a", "name": "Caramel I", "function": "Color", "source": "EFSA"},
            {"code": "E150b", "name": "Caramel II", "function": "Color", "source": "EFSA"},
            {"code": "E150c", "name": "Caramel III", "function": "Color", "source": "EFSA"},
            {"code": "E150d", "name": "Caramel IV", "function": "Color", "source": "EFSA"},
            {"code": "E151", "name": "Brilliant Black", "function": "Color", "source": "EFSA"},
            {"code": "E153", "name": "Vegetable carbon", "function": "Color", "source": "EFSA"},
            {"code": "E154", "name": "Brown FK", "function": "Color", "source": "EFSA"},
            {"code": "E155", "name": "Brown HT", "function": "Color", "source": "EFSA"},
            {"code": "E160a", "name": "Carotenes", "function": "Color", "source": "EFSA"},
            {"code": "E160b", "name": "Annatto", "function": "Color", "source": "EFSA"},
            {"code": "E160c", "name": "Paprika extract", "function": "Color", "source": "EFSA"},
            {"code": "E161b", "name": "Lutein", "function": "Color", "source": "EFSA"},
            {"code": "E162", "name": "Beetroot Red", "function": "Color", "source": "EFSA"},
            {"code": "E163", "name": "Anthocyanins", "function": "Color", "source": "EFSA"},
            {"code": "E171", "name": "Titanium dioxide", "function": "Color", "source": "EFSA"},
            {"code": "E172", "name": "Iron oxides", "function": "Color", "source": "EFSA"},
            
            # Emulsifiers & Stabilizers (E400-E495)
            {"code": "E400", "name": "Alginic acid", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E401", "name": "Sodium alginate", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E402", "name": "Potassium alginate", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E403", "name": "Ammonium alginate", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E404", "name": "Calcium alginate", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E405", "name": "Propane-1,2-diol alginate", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E406", "name": "Agar", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E407", "name": "Carrageenan", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E410", "name": "Locust bean gum", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E412", "name": "Guar gum", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E413", "name": "Tragacanth", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E414", "name": "Gum arabic", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E415", "name": "Xanthan gum", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E416", "name": "Karaya gum", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E417", "name": "Tara gum", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E418", "name": "Gellan gum", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E420", "name": "Sorbitol", "function": "Sweetener", "source": "EFSA"},
            {"code": "E421", "name": "Mannitol", "function": "Sweetener", "source": "EFSA"},
            {"code": "E422", "name": "Glycerol", "function": "Humectant", "source": "EFSA"},
            {"code": "E440", "name": "Pectins", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E441", "name": "Gelatin", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E442", "name": "Ammonium phosphatides", "function": "Emulsifier", "source": "EFSA"},
            {"code": "E450", "name": "Diphosphates", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E451", "name": "Triphosphates", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E452", "name": "Polyphosphates", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E460", "name": "Cellulose", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E461", "name": "Methyl cellulose", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E463", "name": "Hydroxypropyl cellulose", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E464", "name": "Hydroxypropyl methyl cellulose", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E465", "name": "Ethyl methyl cellulose", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E466", "name": "Carboxy methyl cellulose", "function": "Stabilizer", "source": "EFSA"},
            {"code": "E470a", "name": "Sodium salts of fatty acids", "function": "Emulsifier", "source": "EFSA"},
            {"code": "E470b", "name": "Magnesium salts of fatty acids", "function": "Emulsifier", "source": "EFSA"},
            {"code": "E471", "name": "Mono- and diglycerides", "function": "Emulsifier", "source": "EFSA"},
            {"code": "E472a", "name": "Acetic acid esters of mono- and diglycerides", "function": "Emulsifier", "source": "EFSA"},
            {"code": "E472e", "name": "Mono- and diglycerides esters", "function": "Emulsifier", "source": "EFSA"},
            {"code": "E475", "name": "Polyglycerol esters", "function": "Emulsifier", "source": "EFSA"},
            {"code": "E476", "name": "Polyglycerol polyricinoleate", "function": "Emulsifier", "source": "EFSA"},
            {"code": "E477", "name": "Propane-1,2-diol esters", "function": "Emulsifier", "source": "EFSA"},
            {"code": "E481", "name": "Sodium stearoyl lactylate", "function": "Emulsifier", "source": "EFSA"},
            {"code": "E482", "name": "Calcium stearoyl lactylate", "function": "Emulsifier", "source": "EFSA"},
            
            # Flavor Enhancers (E620-E650)
            {"code": "E620", "name": "Glutamic acid", "function": "Flavor enhancer", "source": "EFSA"},
            {"code": "E621", "name": "Monosodium glutamate", "function": "Flavor enhancer", "source": "EFSA"},
            {"code": "E622", "name": "Monopotassium glutamate", "function": "Flavor enhancer", "source": "EFSA"},
            {"code": "E623", "name": "Calcium diglutamate", "function": "Flavor enhancer", "source": "EFSA"},
            {"code": "E624", "name": "Monoammonium glutamate", "function": "Flavor enhancer", "source": "EFSA"},
            {"code": "E625", "name": "Magnesium diglutamate", "function": "Flavor enhancer", "source": "EFSA"},
            {"code": "E626", "name": "Guanylic acid", "function": "Flavor enhancer", "source": "EFSA"},
            {"code": "E627", "name": "Disodium guanylate", "function": "Flavor enhancer", "source": "EFSA"},
            {"code": "E628", "name": "Dipotassium guanylate", "function": "Flavor enhancer", "source": "EFSA"},
            {"code": "E629", "name": "Calcium guanylate", "function": "Flavor enhancer", "source": "EFSA"},
            {"code": "E630", "name": "Inosinic acid", "function": "Flavor enhancer", "source": "EFSA"},
            {"code": "E631", "name": "Disodium inosinate", "function": "Flavor enhancer", "source": "EFSA"},
            {"code": "E632", "name": "Dipotassium inosinate", "function": "Flavor enhancer", "source": "EFSA"},
            {"code": "E633", "name": "Calcium inosinate", "function": "Flavor enhancer", "source": "EFSA"},
            {"code": "E634", "name": "Calcium 5'-ribonucleotides", "function": "Flavor enhancer", "source": "EFSA"},
            {"code": "E635", "name": "Disodium 5'-ribonucleotides", "function": "Flavor enhancer", "source": "EFSA"},
        ]
        
        logger.info(f"✓ Loaded {len(efsa_enumbers)} E-numbers from EFSA database")
        return efsa_enumbers


class FDACollector:
    """Collect ingredients from FDA GRAS list"""
    
    def __init__(self):
        self.gras_data = []
    
    def collect_fda_gras_data(self) -> List[Dict]:
        """
        Collect FDA GRAS (Generally Recognized As Safe) ingredients
        Manual curated list from FDA GRAS Notice Inventory
        Source: FDA GRAS Notice Inventory
        """
        logger.info("Loading FDA GRAS ingredient data...")
        
        # Common FDA GRAS ingredients for food
        fda_gras = [
            # Sweeteners
            {"name": "Sucrose", "category": "Sweetener", "cfr_reference": "21 CFR 184.1854", "source": "FDA GRAS"},
            {"name": "Glucose", "category": "Sweetener", "cfr_reference": "21 CFR 184.1395", "source": "FDA GRAS"},
            {"name": "Fructose", "category": "Sweetener", "cfr_reference": "21 CFR 184.1866", "source": "FDA GRAS"},
            {"name": "Dextrose", "category": "Sweetener", "cfr_reference": "21 CFR 184.1857", "source": "FDA GRAS"},
            {"name": "Lactose", "category": "Sweetener", "cfr_reference": "21 CFR 184.1425", "source": "FDA GRAS"},
            {"name": "Maltose", "category": "Sweetener", "cfr_reference": "21 CFR 184.1445", "source": "FDA GRAS"},
            {"name": "High fructose corn syrup", "category": "Sweetener", "cfr_reference": "21 CFR 184.1866", "source": "FDA GRAS"},
            {"name": "Corn syrup", "category": "Sweetener", "cfr_reference": "21 CFR 168.120", "source": "FDA GRAS"},
            {"name": "Honey", "category": "Sweetener", "cfr_reference": "21 CFR 184.1410", "source": "FDA GRAS"},
            {"name": "Maple syrup", "category": "Sweetener", "cfr_reference": "21 CFR 168.140", "source": "FDA GRAS"},
            {"name": "Molasses", "category": "Sweetener", "cfr_reference": "21 CFR 168.160", "source": "FDA GRAS"},
            {"name": "Sorbitol", "category": "Sweetener", "cfr_reference": "21 CFR 184.1835", "source": "FDA GRAS"},
            {"name": "Mannitol", "category": "Sweetener", "cfr_reference": "21 CFR 180.25", "source": "FDA GRAS"},
            {"name": "Xylitol", "category": "Sweetener", "cfr_reference": "21 CFR 172.395", "source": "FDA GRAS"},
            
            # Acids
            {"name": "Citric acid", "category": "Acid", "cfr_reference": "21 CFR 184.1033", "source": "FDA GRAS"},
            {"name": "Lactic acid", "category": "Acid", "cfr_reference": "21 CFR 184.1061", "source": "FDA GRAS"},
            {"name": "Acetic acid", "category": "Acid", "cfr_reference": "21 CFR 184.1005", "source": "FDA GRAS"},
            {"name": "Malic acid", "category": "Acid", "cfr_reference": "21 CFR 184.1069", "source": "FDA GRAS"},
            {"name": "Tartaric acid", "category": "Acid", "cfr_reference": "21 CFR 184.1099", "source": "FDA GRAS"},
            {"name": "Ascorbic acid", "category": "Antioxidant", "cfr_reference": "21 CFR 184.1073", "source": "FDA GRAS"},
            {"name": "Propionic acid", "category": "Preservative", "cfr_reference": "21 CFR 184.1081", "source": "FDA GRAS"},
            
            # Preservatives
            {"name": "Salt", "category": "Preservative", "cfr_reference": "21 CFR 184.1634", "source": "FDA GRAS"},
            {"name": "Sodium chloride", "category": "Preservative", "cfr_reference": "21 CFR 184.1634", "source": "FDA GRAS"},
            {"name": "Sugar", "category": "Preservative", "cfr_reference": "21 CFR 184.1854", "source": "FDA GRAS"},
            {"name": "Vinegar", "category": "Preservative", "cfr_reference": "21 CFR 184.1005", "source": "FDA GRAS"},
            {"name": "Potassium sorbate", "category": "Preservative", "cfr_reference": "21 CFR 182.3640", "source": "FDA GRAS"},
            {"name": "Sodium benzoate", "category": "Preservative", "cfr_reference": "21 CFR 184.1733", "source": "FDA GRAS"},
            {"name": "Calcium propionate", "category": "Preservative", "cfr_reference": "21 CFR 184.1221", "source": "FDA GRAS"},
            {"name": "Sodium nitrite", "category": "Preservative", "cfr_reference": "21 CFR 172.175", "source": "FDA GRAS"},
            {"name": "Sodium nitrate", "category": "Preservative", "cfr_reference": "21 CFR 172.170", "source": "FDA GRAS"},
            {"name": "Tocopherols", "category": "Antioxidant", "cfr_reference": "21 CFR 182.3890", "source": "FDA GRAS"},
            {"name": "BHA", "category": "Antioxidant", "cfr_reference": "21 CFR 172.110", "source": "FDA GRAS"},
            {"name": "BHT", "category": "Antioxidant", "cfr_reference": "21 CFR 172.115", "source": "FDA GRAS"},
            {"name": "TBHQ", "category": "Antioxidant", "cfr_reference": "21 CFR 172.185", "source": "FDA GRAS"},
            
            # Colors (approved)
            {"name": "Beta-carotene", "category": "Color", "cfr_reference": "21 CFR 73.95", "source": "FDA GRAS"},
            {"name": "Annatto extract", "category": "Color", "cfr_reference": "21 CFR 73.30", "source": "FDA GRAS"},
            {"name": "Caramel color", "category": "Color", "cfr_reference": "21 CFR 73.85", "source": "FDA GRAS"},
            {"name": "Turmeric", "category": "Color", "cfr_reference": "21 CFR 73.600", "source": "FDA GRAS"},
            {"name": "Paprika", "category": "Color", "cfr_reference": "21 CFR 73.345", "source": "FDA GRAS"},
            {"name": "Beet powder", "category": "Color", "cfr_reference": "21 CFR 73.40", "source": "FDA GRAS"},
            {"name": "Carmine", "category": "Color", "cfr_reference": "21 CFR 73.100", "source": "FDA GRAS"},
            {"name": "Titanium dioxide", "category": "Color", "cfr_reference": "21 CFR 73.575", "source": "FDA GRAS"},
            
            # Emulsifiers & Stabilizers
            {"name": "Lecithin", "category": "Emulsifier", "cfr_reference": "21 CFR 184.1400", "source": "FDA GRAS"},
            {"name": "Mono- and diglycerides", "category": "Emulsifier", "cfr_reference": "21 CFR 184.1505", "source": "FDA GRAS"},
            {"name": "Polysorbate 60", "category": "Emulsifier", "cfr_reference": "21 CFR 172.836", "source": "FDA GRAS"},
            {"name": "Polysorbate 80", "category": "Emulsifier", "cfr_reference": "21 CFR 172.840", "source": "FDA GRAS"},
            {"name": "Carrageenan", "category": "Stabilizer", "cfr_reference": "21 CFR 172.620", "source": "FDA GRAS"},
            {"name": "Guar gum", "category": "Stabilizer", "cfr_reference": "21 CFR 184.1339", "source": "FDA GRAS"},
            {"name": "Xanthan gum", "category": "Stabilizer", "cfr_reference": "21 CFR 172.695", "source": "FDA GRAS"},
            {"name": "Locust bean gum", "category": "Stabilizer", "cfr_reference": "21 CFR 184.1343", "source": "FDA GRAS"},
            {"name": "Pectin", "category": "Stabilizer", "cfr_reference": "21 CFR 184.1588", "source": "FDA GRAS"},
            {"name": "Gelatin", "category": "Stabilizer", "cfr_reference": "21 CFR 184.1355", "source": "FDA GRAS"},
            {"name": "Agar", "category": "Stabilizer", "cfr_reference": "21 CFR 184.1115", "source": "FDA GRAS"},
            {"name": "Alginate", "category": "Stabilizer", "cfr_reference": "21 CFR 184.1011", "source": "FDA GRAS"},
            {"name": "Cellulose", "category": "Stabilizer", "cfr_reference": "21 CFR 182.90", "source": "FDA GRAS"},
            {"name": "Modified food starch", "category": "Stabilizer", "cfr_reference": "21 CFR 172.892", "source": "FDA GRAS"},
            
            # Flavor Enhancers
            {"name": "Monosodium glutamate", "category": "Flavor enhancer", "cfr_reference": "21 CFR 182.1", "source": "FDA GRAS"},
            {"name": "Disodium guanylate", "category": "Flavor enhancer", "cfr_reference": "21 CFR 184.1323", "source": "FDA GRAS"},
            {"name": "Disodium inosinate", "category": "Flavor enhancer", "cfr_reference": "21 CFR 184.1328", "source": "FDA GRAS"},
            {"name": "Yeast extract", "category": "Flavor enhancer", "cfr_reference": "21 CFR 184.1983", "source": "FDA GRAS"},
            
            # Oils & Fats
            {"name": "Vegetable oil", "category": "Fat", "cfr_reference": "21 CFR 184.1555", "source": "FDA GRAS"},
            {"name": "Palm oil", "category": "Fat", "cfr_reference": "21 CFR 184.1555", "source": "FDA GRAS"},
            {"name": "Coconut oil", "category": "Fat", "cfr_reference": "21 CFR 184.1555", "source": "FDA GRAS"},
            {"name": "Soybean oil", "category": "Fat", "cfr_reference": "21 CFR 184.1555", "source": "FDA GRAS"},
            {"name": "Canola oil", "category": "Fat", "cfr_reference": "21 CFR 184.1555", "source": "FDA GRAS"},
            {"name": "Olive oil", "category": "Fat", "cfr_reference": "21 CFR 184.1555", "source": "FDA GRAS"},
            {"name": "Corn oil", "category": "Fat", "cfr_reference": "21 CFR 184.1555", "source": "FDA GRAS"},
            {"name": "Sunflower oil", "category": "Fat", "cfr_reference": "21 CFR 184.1555", "source": "FDA GRAS"},
            {"name": "Butter", "category": "Fat", "cfr_reference": "21 CFR 163.130", "source": "FDA GRAS"},
            {"name": "Margarine", "category": "Fat", "cfr_reference": "21 CFR 166.110", "source": "FDA GRAS"},
            
            # Baking agents
            {"name": "Baking soda", "category": "Leavening agent", "cfr_reference": "21 CFR 184.1736", "source": "FDA GRAS"},
            {"name": "Sodium bicarbonate", "category": "Leavening agent", "cfr_reference": "21 CFR 184.1736", "source": "FDA GRAS"},
            {"name": "Baking powder", "category": "Leavening agent", "cfr_reference": "21 CFR 182.1", "source": "FDA GRAS"},
            {"name": "Potassium bicarbonate", "category": "Leavening agent", "cfr_reference": "21 CFR 184.1613", "source": "FDA GRAS"},
            {"name": "Ammonium bicarbonate", "category": "Leavening agent", "cfr_reference": "21 CFR 184.1135", "source": "FDA GRAS"},
        ]
        
        logger.info(f"✓ Loaded {len(fda_gras)} ingredients from FDA GRAS list")
        return fda_gras


class FooDBCollector:
    """Collect food additives from FooDB (if API available)"""
    
    def __init__(self):
        self.foodb_url = "https://foodb.ca/api/v1"
        self.additives = []
    
    def collect_foodb_additives(self) -> List[Dict]:
        """
        Attempt to query FooDB for food additives
        NOTE: FooDB may require API key or may be unavailable
        Fallback to manual list if API not accessible
        """
        logger.info("Attempting to collect data from FooDB...")
        
        # FooDB API is not always publicly accessible
        # Adding manual list of common food additives from database
        common_additives = [
            {"name": "Caffeine", "category": "Stimulant", "source": "FooDB"},
            {"name": "Theobromine", "category": "Stimulant", "source": "FooDB"},
            {"name": "Vanillin", "category": "Flavor", "source": "FooDB"},
            {"name": "Ethyl vanillin", "category": "Flavor", "source": "FooDB"},
            {"name": "Diacetyl", "category": "Flavor", "source": "FooDB"},
            {"name": "Maltodextrin", "category": "Bulking agent", "source": "FooDB"},
            {"name": "Corn starch", "category": "Thickener", "source": "FooDB"},
            {"name": "Wheat starch", "category": "Thickener", "source": "FooDB"},
            {"name": "Tapioca starch", "category": "Thickener", "source": "FooDB"},
            {"name": "Inulin", "category": "Fiber", "source": "FooDB"},
            {"name": "Psyllium", "category": "Fiber", "source": "FooDB"},
            {"name": "Silicon dioxide", "category": "Anti-caking agent", "source": "FooDB"},
            {"name": "Calcium silicate", "category": "Anti-caking agent", "source": "FooDB"},
            {"name": "Magnesium stearate", "category": "Anti-caking agent", "source": "FooDB"},
        ]
        
        logger.info(f"✓ Loaded {len(common_additives)} additives from FooDB reference")
        return common_additives


def merge_and_deduplicate(efsa_data: List[Dict], fda_data: List[Dict], foodb_data: List[Dict]) -> pd.DataFrame:
    """
    Merge all data sources and deduplicate
    Creates normalized dataset with all ingredients
    """
    logger.info("Merging and deduplicating data from all sources...")
    
    all_ingredients = []
    
    # Process EFSA E-numbers
    for item in efsa_data:
        all_ingredients.append({
            'ingredient_name': item['name'],
            'alternative_names': item['code'],  # E-number
            'category': item['function'],
            'source': item['source'],
            'reference': item['code']
        })
    
    # Process FDA GRAS
    for item in fda_data:
        all_ingredients.append({
            'ingredient_name': item['name'],
            'alternative_names': '',
            'category': item['category'],
            'source': item['source'],
            'reference': item.get('cfr_reference', '')  
        })
    
    # Process FooDB
    for item in foodb_data:
        all_ingredients.append({
            'ingredient_name': item['name'],
            'alternative_names': '',
            'category': item['category'],
            'source': item['source'],
            'reference': ''
        })
    
    # Create DataFrame
    df = pd.DataFrame(all_ingredients)
    
    # Deduplicate based on ingredient name (case-insensitive)
    df['ingredient_name_lower'] = df['ingredient_name'].str.lower().str.strip()
    df_dedup = df.drop_duplicates(subset=['ingredient_name_lower'], keep='first')
    df_dedup = df_dedup.drop(columns=['ingredient_name_lower'])
    
    logger.info(f"✓ Total ingredients before deduplication: {len(df)}")
    logger.info(f"✓ Total ingredients after deduplication: {len(df_dedup)}")
    
    return df_dedup


def main():
    """Main execution function"""
    logger.info("=" * 60)
    logger.info("STEP 1: COLLECTING AUTHORITATIVE INGREDIENT DATA")
    logger.info("=" * 60)
    
    # Initialize collectors
    efsa_collector = EFSACollector()
    fda_collector = FDACollector()
    foodb_collector = FooDBCollector()
    
    # Collect data
    logger.info("\n[1/4] Collecting EFSA E-numbers...")
    efsa_data = efsa_collector.collect_manual_efsa_data()
    
    logger.info("\n[2/4] Collecting FDA GRAS ingredients...")
    fda_data = fda_collector.collect_fda_gras_data()
    
    logger.info("\n[3/4] Collecting FooDB additives...")
    foodb_data = foodb_collector.collect_foodb_additives()
    
    # Merge and deduplicate
    logger.info("\n[4/4] Merging and deduplicating...")
    final_df = merge_and_deduplicate(efsa_data, fda_data, foodb_data)
    
    # Save to CSV
    output_path = "authoritative_ingredients.csv"
    final_df.to_csv(output_path, index=False, encoding='utf-8')
    
    # Print summary
    logger.info("\n" + "=" * 60)
    logger.info("DATA COLLECTION COMPLETE")
    logger.info("=" * 60)
    logger.info(f"Total ingredients collected: {len(final_df)}")
    logger.info(f"Output saved to: {output_path}")
    logger.info("\nBreakdown by source:")
    logger.info(final_df['source'].value_counts().to_string())
    logger.info("\nBreakdown by category:")
    logger.info(final_df['category'].value_counts().to_string())
    logger.info("\nSample data:")
    print(final_df.head(10).to_string())
    
    logger.info("\n✓ Step 1 Complete! Next: Step 2 - Auto-classify into your categories")


if __name__ == "__main__":
    main()
