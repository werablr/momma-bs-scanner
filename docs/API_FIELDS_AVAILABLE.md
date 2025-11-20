# API Fields Available - Complete Data Capture Strategy

**Date:** November 20, 2025
**Purpose:** Document all available fields from Open Food Facts and USDA APIs for complete data capture

---

## Philosophy: "Capture Everything, Show the Best"

We store **ALL fields** from each API source, not just the 10-15 we currently use. This ensures:
- **Zero data loss** - Never filter or subset API responses
- **Future-proof** - New features can use fields we captured today
- **Complete provenance** - Know exactly what each API provided
- **Quality comparison** - Compare sources to spot errors
- **User trust** - Full transparency of data sources

---

## Open Food Facts API (~238 fields available)

### Currently Captured (~30 fields)
- Basic: `product_name`, `brands`, `generic_name`
- Nutrition (per 100g): `energy-kcal`, `proteins`, `fat`, `saturated-fat`, `trans-fat`, `carbohydrates`, `fiber`, `sugars`, `sodium`, `potassium`
- Health: `nutriscore_grade`, `nova_group`, `ecoscore_grade`, `nutrient_levels`
- Dietary: `ingredients_analysis_tags` (vegan, vegetarian, palm-oil-free)
- Allergens: `allergens`, `traces`
- Environmental: `packaging`, `origins`, `countries`, `manufacturing_places`
- Images: `image_url`, `image_small_url`, `image_thumb_url`
- Labels: `labels`, `labels_tags`

### NOT Currently Captured (~208 fields!)

#### Additional Nutrition (~50 nutrients available in `nutriments` object)
- **Vitamins:** `vitamin-a`, `vitamin-b1`, `vitamin-b2`, `vitamin-b6`, `vitamin-b12`, `vitamin-c`, `vitamin-d`, `vitamin-e`, `vitamin-k`, `folates`, `biotin`, `pantothenic-acid`
- **Minerals:** `calcium`, `iron`, `magnesium`, `phosphorus`, `zinc`, `copper`, `manganese`, `selenium`, `chromium`, `molybdenum`, `iodine`, `chloride`
- **Fats:** `monounsaturated-fat`, `polyunsaturated-fat`, `omega-3-fat`, `omega-6-fat`, `omega-9-fat`, `cholesterol`
- **Carbs:** `starch`, `polyols`, `erythritol`
- **Amino Acids:** `alanine`, `arginine`, `aspartic-acid`, `cysteine`, `glutamic-acid`, `glycine`, `histidine`, `isoleucine`, `leucine`, `lysine`, `methionine`, `phenylalanine`, `proline`, `serine`, `threonine`, `tryptophan`, `tyrosine`, `valine`
- **Other:** `caffeine`, `taurine`, `alcohol`, `ph`, `fruits-vegetables-nuts`, `collagen-meat-protein-ratio`

#### Product Identity & Metadata
- **Identification:** `_id`, `code`, `id`, `_keywords`
- **Barcodes:** `codes_tags`
- **Creation:** `created_t`, `creator`, `last_modified_t`, `last_modified_by`
- **Completeness:** `complete`, `completeness`, `data_quality_*` (bugs, errors, warnings, info tags)

#### Categories & Classification
- **Categories:** `categories`, `categories_hierarchy`, `categories_tags`, `categories_properties`, `categories_properties_tags`
- **Food Groups:** `food_groups`, `food_groups_tags`
- **CIQUAL:** `ciqual_food_name_tags`

#### Ingredients
- **Text:** `ingredients_text` (multiple languages), `ingredients_text_with_allergens`
- **Analysis:** `ingredients_analysis`, `ingredients_analysis_tags`
- **Hierarchy:** `ingredients_hierarchy`, `ingredients_ids_debug`
- **Counts:** `ingredients_n`, `additives_n`, `ingredients_from_palm_oil_n`, `ingredients_that_may_be_from_palm_oil_n`
- **Additives:** `additives_tags`, `additives_original_tags`
- **Sweeteners:** `ingredients_sweeteners_n`, `ingredients_non_nutritive_sweeteners_n`
- **Debug:** `ingredients_debug`, `ingredients_percent_analysis`

#### Packaging & Location
- **Packaging:** `packaging_type`, `packaging_tags`, `packaging_text`, `packaging_materials`
- **Geography:** `countries`, `countries_hierarchy`, `countries_tags`, `cities_tags`, `states_tags`
- **Manufacturing:** `manufacturing_places`, `emb_codes`, `emb_codes_tags`
- **Purchase:** `stores`, `stores_tags`, `purchase_places`

#### Images (Multiple Languages & Types)
- **Front:** `image_front_url`, `image_front_small_url`, `image_front_thumb_url` (+ language variants)
- **Ingredients:** `image_ingredients_url`, `image_ingredients_small_url`, `image_ingredients_thumb_url`
- **Nutrition:** `image_nutrition_url`, `image_nutrition_small_url`, `image_nutrition_thumb_url`
- **Packaging:** `image_packaging_url`, `image_packaging_small_url`, `image_packaging_thumb_url`
- **Raw Images:** `images` (object with all uploaded images by language/type)

#### Environmental & Eco-Score
- **Eco-Score:** `ecoscore_grade`, `ecoscore_score`, `ecoscore_data` (detailed breakdown)
- **Carbon:** `carbon_footprint_from_known_ingredients_debug`, `ecoscore_data.agribalyse`
- **Packaging Impact:** `ecoscore_data.adjustments.packaging`
- **Production System:** `ecoscore_data.adjustments.production_system`
- **Threatened Species:** `ecoscore_data.adjustments.threatened_species`

#### Labels & Certifications
- **Labels:** `labels`, `labels_tags`, `labels_hierarchy`
- **Certifications:** Organic, Fair Trade, PDO, PGI, etc. (in labels_tags)

#### Quality & Data Sources
- **Quality Tags:** `data_quality_tags`, `data_quality_bugs_tags`, `data_quality_errors_tags`, `data_quality_warnings_tags`, `data_quality_info_tags`
- **Sources:** `data_sources`, `data_sources_tags`
- **Editors:** `editors_tags`, `checkers_tags`, `informers_tags`, `correctors_tags`, `photographers_tags`

#### Serving & Quantity
- **Serving:** `serving_size`, `serving_quantity`, `serving_quantity_unit`
- **Quantity:** `product_quantity`, `product_quantity_unit`, `quantity`
- **Net Content:** `net_weight`, `drained_weight`

#### Misc Product Info
- **Expiration:** `expiration_date`
- **Customer Service:** `customer_service`, `consumer_service_mail`
- **Link:** `link`
- **Entry Dates:** `entry_dates_tags`
- **Compared Category:** `compared_to_category`

---

## USDA FoodData Central API (~150+ nutrients available)

### Currently Captured (~16 fields)
- **Macronutrients:** `energy`, `protein`, `total_fat`, `saturated_fat`, `trans_fat`, `carbohydrate`, `fiber`, `sugars`, `added_sugars`
- **Minerals:** `sodium`, `calcium`, `iron`, `potassium`
- **Vitamins:** `vitamin_d`
- **Metadata:** `fdc_id`, `raw_data` (JSONB)

### NOT Currently Captured (~134+ nutrients!)

#### Complete USDA Nutrient List (from SR Legacy)

**Macronutrients & Energy:**
- Protein, Total lipid (fat), Carbohydrate, Energy (kcal), Energy (kJ)
- Fiber (total dietary, soluble, insoluble)
- Sugars (total, added, glucose, fructose, sucrose, lactose, maltose, galactose)
- Starch
- Water
- Ash
- Alcohol (ethyl)
- Caffeine
- Theobromine

**Fats & Fatty Acids (50+ specific fatty acids):**
- Saturated: 4:0, 6:0, 8:0, 10:0, 12:0, 14:0, 16:0, 18:0, 20:0, 22:0, 24:0
- Monounsaturated: 14:1, 16:1, 18:1, 20:1, 22:1, 24:1
- Polyunsaturated: 18:2, 18:3, 18:4, 20:2, 20:3, 20:4, 20:5 (EPA), 22:5 (DPA), 22:6 (DHA)
- Trans fats: Trans-monoenoic, Trans-polyenoic
- Cholesterol
- Phytosterols

**Amino Acids (18 essential + non-essential):**
- Essential: Histidine, Isoleucine, Leucine, Lysine, Methionine, Phenylalanine, Threonine, Tryptophan, Valine
- Non-essential: Alanine, Arginine, Aspartic acid, Cystine, Glutamic acid, Glycine, Proline, Serine, Tyrosine
- Hydroxyproline

**Vitamins (25+ forms):**
- Vitamin A (IU, RAE, retinol, carotenes)
- Vitamin B1 (Thiamin)
- Vitamin B2 (Riboflavin)
- Vitamin B3 (Niacin)
- Vitamin B5 (Pantothenic acid)
- Vitamin B6 (Pyridoxine)
- Vitamin B9 (Folate, DFE, food folate, folic acid)
- Vitamin B12 (Cobalamin)
- Vitamin C (Ascorbic acid)
- Vitamin D (D2, D3, IU)
- Vitamin E (alpha-tocopherol, added)
- Vitamin K (phylloquinone, menaquinone-4, dihydrophylloquinone)
- Choline (total, free, from phosphocholine, from phosphotidyl choline, from glycerophosphocholine, from sphingomyelin)
- Betaine

**Minerals (16 major + trace):**
- Calcium, Ca
- Iron, Fe
- Magnesium, Mg
- Phosphorus, P
- Potassium, K
- Sodium, Na
- Zinc, Zn
- Copper, Cu
- Manganese, Mn
- Selenium, Se
- Fluoride, F
- Chloride, Cl
- Chromium, Cr
- Iodine, I
- Molybdenum, Mo
- Sulfur, S

**Phytochemicals & Other Components:**
- Beta-carotene, Alpha-carotene, Beta-cryptoxanthin
- Lycopene, Lutein + zeaxanthin
- Phytosterols (Campesterol, Stigmasterol, Beta-sitosterol)
- Tocopherols (beta, gamma, delta)
- Tocotrienols (alpha, beta, gamma, delta)

**Food-Specific Metadata:**
- FDC ID
- Description
- Data Type (Foundation, SR Legacy, Branded, Survey)
- Publication Date
- Food Category
- Scientific Name (for Foundation Foods)
- NDB Number (legacy SR)
- GTIN/UPC (for Branded Foods)
- Brand Owner, Brand Name
- Ingredients
- Serving Size, Serving Unit
- Household Serving
- Food Code (for Survey Foods)

---

## Current Database Schema Gaps

### Open Food Facts - Missing Columns (~200 fields)
We currently capture ~30 fields. We're missing:
- **Vitamins:** A, B1, B2, B6, B12, C, D, E, K, folates (10+ fields)
- **Minerals:** calcium, magnesium, phosphorus, zinc, iron, copper, selenium (10+ fields)
- **Fats:** monounsaturated, polyunsaturated, omega-3, omega-6, cholesterol (5+ fields)
- **Amino Acids:** All 18 amino acids (18 fields)
- **Product Metadata:** completeness, data_quality_tags, editors, images per language (50+ fields)
- **Environmental:** ecoscore_data detailed breakdown, carbon footprint (20+ fields)
- **Serving Info:** serving_size, serving_quantity, net_weight (5 fields)

### USDA - Missing Columns (~130 fields)
We currently capture ~16 fields. We're missing:
- **Fatty Acids:** 50+ specific fatty acid profiles
- **Amino Acids:** 18 amino acids
- **Vitamins:** Complete vitamin profiles (20+ fields)
- **Minerals:** Complete mineral profiles (10+ fields)
- **Phytochemicals:** Carotenoids, phytosterols, tocopherols (15+ fields)
- **Sugars:** Individual sugar types (glucose, fructose, etc.) (8 fields)

---

## Recommendation: Complete Data Capture

### Approach
1. **Store raw JSONB** - Already doing this with `openfoodfacts_raw_data`, `upcitemdb_raw_data`, `usda_raw_data`
2. **Add commonly used fields as typed columns** - For fast querying and indexing
3. **Keep raw data for everything else** - Can be queried when needed

### Priority Fields to Add (Next Migration)

**Open Food Facts (30 new columns):**
```sql
-- Vitamins (per 100g)
off_vitamin_a DECIMAL,
off_vitamin_b1 DECIMAL,
off_vitamin_b2 DECIMAL,
off_vitamin_b6 DECIMAL,
off_vitamin_b12 DECIMAL,
off_vitamin_c DECIMAL,
off_vitamin_d DECIMAL,
off_vitamin_e DECIMAL,
off_vitamin_k DECIMAL,
off_folates DECIMAL,

-- Minerals (per 100g)
off_calcium DECIMAL,
off_magnesium DECIMAL,
off_phosphorus DECIMAL,
off_zinc DECIMAL,
off_copper DECIMAL,
off_selenium DECIMAL,

-- Fats (per 100g)
off_monounsaturated_fat DECIMAL,
off_polyunsaturated_fat DECIMAL,
off_omega_3_fat DECIMAL,
off_omega_6_fat DECIMAL,
off_cholesterol DECIMAL,

-- Carbs (per 100g)
off_starch DECIMAL,

-- Product Info
off_serving_size TEXT,
off_serving_quantity DECIMAL,
off_product_quantity DECIMAL,
off_product_quantity_unit TEXT,

-- Environmental
off_ecoscore_score INTEGER,
off_carbon_footprint DECIMAL,

-- Quality
off_completeness DECIMAL,
off_data_quality_tags JSONB,
```

**USDA (50+ new columns):**
```sql
-- Fatty Acids (g per 100g)
usda_monounsaturated_fat DECIMAL,
usda_polyunsaturated_fat DECIMAL,
usda_omega_3_epa DECIMAL,
usda_omega_3_dha DECIMAL,
usda_omega_6 DECIMAL,
usda_cholesterol DECIMAL,

-- Amino Acids (g per 100g) - 18 fields
usda_histidine DECIMAL,
usda_isoleucine DECIMAL,
usda_leucine DECIMAL,
usda_lysine DECIMAL,
usda_methionine DECIMAL,
usda_phenylalanine DECIMAL,
usda_threonine DECIMAL,
usda_tryptophan DECIMAL,
usda_valine DECIMAL,
usda_alanine DECIMAL,
usda_arginine DECIMAL,
usda_aspartic_acid DECIMAL,
usda_cystine DECIMAL,
usda_glutamic_acid DECIMAL,
usda_glycine DECIMAL,
usda_proline DECIMAL,
usda_serine DECIMAL,
usda_tyrosine DECIMAL,

-- Vitamins
usda_vitamin_a DECIMAL,
usda_vitamin_b1 DECIMAL,
usda_vitamin_b2 DECIMAL,
usda_vitamin_b3 DECIMAL,
usda_vitamin_b6 DECIMAL,
usda_vitamin_b12 DECIMAL,
usda_vitamin_c DECIMAL,
usda_vitamin_e DECIMAL,
usda_vitamin_k DECIMAL,
usda_folate DECIMAL,
usda_choline DECIMAL,

-- Minerals
usda_magnesium DECIMAL,
usda_phosphorus DECIMAL,
usda_zinc DECIMAL,
usda_copper DECIMAL,
usda_manganese DECIMAL,
usda_selenium DECIMAL,

-- Phytochemicals
usda_beta_carotene DECIMAL,
usda_lycopene DECIMAL,
usda_lutein_zeaxanthin DECIMAL,

-- Sugars
usda_glucose DECIMAL,
usda_fructose DECIMAL,
usda_sucrose DECIMAL,
usda_lactose DECIMAL,
```

---

## Implementation Plan

### Phase 1: Document Current State ✅ (This File)
- List all available fields from both APIs
- Identify gaps in current schema
- Prioritize fields for capture

### Phase 2: Expand Database Schema
- Add 30 most useful OFF fields as typed columns
- Add 50 most useful USDA fields as typed columns
- Keep raw JSONB for everything else
- Maintain backward compatibility

### Phase 3: Update Edge Functions
- Expand `extractOFFNutrition()` to capture all new fields
- Expand USDA extraction to capture all new fields
- No filtering - store everything available

### Phase 4: Update Pantry App
- Add "Advanced Nutrition" view showing micronutrients
- Add "Data Sources" comparison view
- Continue using COALESCE for display

---

## Benefits of Complete Capture

1. **Zero Data Loss** - Never throw away API data
2. **Future Features** - "Show me high-calcium foods" without re-scanning
3. **Quality Comparison** - Spot API errors by comparing sources
4. **User Trust** - Full transparency ("This iron value came from USDA")
5. **Cost Savings** - Never need to re-call APIs for more data
6. **Research** - Analyze consumption patterns by micronutrients

---

**Next Steps:** Review this document, then proceed with Phase 2 (schema expansion migration).
