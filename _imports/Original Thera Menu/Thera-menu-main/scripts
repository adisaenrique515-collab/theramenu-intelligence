param(
  [string]$DatasetDir = "C:\Users\erick\Downloads\Thera-menu-main-patched\Thera-menu-main\data\usda\foundation_csv\FoodData_Central_foundation_food_csv_2025-12-18",
  [string]$OutputFile = "C:\Users\erick\Downloads\Thera-menu-main-patched\Thera-menu-main\config\usdaFoundationFoods.generated.ts"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function To-DoubleOrNull([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return $null }
  $out = 0.0
  if ([double]::TryParse($value, [Globalization.NumberStyles]::Any, [Globalization.CultureInfo]::InvariantCulture, [ref]$out)) {
    return $out
  }
  return $null
}

function Round-1([double]$value) {
  return [math]::Round($value, 1)
}

function Escape-SingleQuote([string]$text) {
  return $text.Replace("'", "\'")
}

function Resolve-Category([string]$categoryDescription, [string]$foodName) {
  $c = ([string]$categoryDescription).ToLowerInvariant()
  $n = ([string]$foodName).ToLowerInvariant()

  if ($c -match "beverage|alcoholic") { return "beverage" }
  if ($c -match "soups|sauces|gravies") { return "broth" }
  if ($c -match "spices|herbs") { return "condiment" }
  if ($c -match "fats|oils") { return "fat" }
  if ($c -match "dairy|egg") { return "dairy" }
  if ($c -match "legume") { return "legume" }
  if ($c -match "fish|poultry|beef|pork|lamb|veal|game|sausage|luncheon") { return "protein" }
  if ($c -match "fruit") { return "fruit" }
  if ($c -match "vegetable") {
    if ($n -match "potato|yam|cassava|plantain|taro|sweet potato") { return "starch" }
    return "vegetable"
  }
  if ($c -match "cereal|grain|pasta|breakfast cereals|baked products") { return "grain" }
  if ($n -match "flour|rice|oat|barley|sorghum|millet|corn|maize") { return "grain" }
  return "protein"
}

function Resolve-TextureTags([string]$category) {
  switch ($category) {
    "beverage" { return @("regular", "soft", "minced", "pureed", "liquid") }
    "broth"    { return @("soft", "liquid") }
    "condiment"{ return @("regular", "soft", "liquid") }
    default    { return @("regular", "soft") }
  }
}

function Resolve-ClinicalTags([string]$category, [string]$name, [double]$sodiumMg, [double]$fatG) {
  $tags = [System.Collections.Generic.HashSet[string]]::new()
  [void]$tags.Add("usda_verified")

  switch ($category) {
    "grain"     { [void]$tags.Add("whole_grain") }
    "protein"   { [void]$tags.Add("protein") }
    "legume"    { [void]$tags.Add("plant_protein"); [void]$tags.Add("high_fiber") }
    "vegetable" { [void]$tags.Add("non_starchy_veg") }
    "fruit"     { [void]$tags.Add("fruit") }
    "beverage"  { [void]$tags.Add("hydration") }
    "broth"     { [void]$tags.Add("gut_safe") }
  }

  if ($sodiumMg -le 120) { [void]$tags.Add("low_sodium") }
  if ($category -eq "protein" -and $fatG -le 10) { [void]$tags.Add("lean_protein") }
  if ($name.ToLowerInvariant() -match "whole|bran|oat|barley") { [void]$tags.Add("low_gi") }
  if ($name.ToLowerInvariant() -match "tilapia|cod|haddock|pollock|chicken breast") { [void]$tags.Add("fresh_lean_protein") }

  return @($tags)
}

$foodRows = Import-Csv (Join-Path $DatasetDir "food.csv") | Where-Object { $_.data_type -eq "foundation_food" }
$categoryRows = Import-Csv (Join-Path $DatasetDir "food_category.csv")
$nutrientRows = Import-Csv (Join-Path $DatasetDir "food_nutrient.csv")

$categoryById = @{}
foreach ($row in $categoryRows) { $categoryById[$row.id] = $row.description }

$requiredNutrients = [System.Collections.Generic.HashSet[string]]::new()
@("1008","2047","1003","1005","1050","1004","1093") | ForEach-Object { [void]$requiredNutrients.Add($_) }

$foundationFdcIds = [System.Collections.Generic.HashSet[string]]::new()
foreach ($f in $foodRows) { [void]$foundationFdcIds.Add($f.fdc_id) }

$nutrientsByFood = @{}
foreach ($row in $nutrientRows) {
  if (-not $foundationFdcIds.Contains($row.fdc_id)) { continue }
  if (-not $requiredNutrients.Contains($row.nutrient_id)) { continue }
  $amount = To-DoubleOrNull $row.amount
  if ($null -eq $amount) { continue }
  if (-not $nutrientsByFood.ContainsKey($row.fdc_id)) { $nutrientsByFood[$row.fdc_id] = @{} }
  if (-not $nutrientsByFood[$row.fdc_id].ContainsKey($row.nutrient_id)) {
    $nutrientsByFood[$row.fdc_id][$row.nutrient_id] = $amount
  }
}

$foods = New-Object System.Collections.Generic.List[object]
foreach ($row in $foodRows) {
  if (-not $nutrientsByFood.ContainsKey($row.fdc_id)) { continue }
  $n = $nutrientsByFood[$row.fdc_id]
  $energy = if ($n.ContainsKey("1008")) { $n["1008"] } elseif ($n.ContainsKey("2047")) { $n["2047"] } else { $null }
  $protein = if ($n.ContainsKey("1003")) { $n["1003"] } else { $null }
  $carbs = if ($n.ContainsKey("1005")) { $n["1005"] } elseif ($n.ContainsKey("1050")) { $n["1050"] } else { $null }
  $fat = if ($n.ContainsKey("1004")) { $n["1004"] } else { $null }
  $sodium = if ($n.ContainsKey("1093")) { $n["1093"] } else { $null }

  if ($null -eq $energy -or $null -eq $protein -or $null -eq $carbs -or $null -eq $fat -or $null -eq $sodium) {
    continue
  }

  $name = $row.description.Trim()
  $categoryDescription = if ($categoryById.ContainsKey($row.food_category_id)) { $categoryById[$row.food_category_id] } else { "" }
  $category = Resolve-Category $categoryDescription $name
  $textureTags = Resolve-TextureTags $category
  $clinicalTags = Resolve-ClinicalTags $category $name $sodium $fat

  $foods.Add([pscustomobject]@{
    food_id = "usda_$($row.fdc_id)"
    name = $name
    category = $category
    cuisine = "USDA"
    texture_tags = $textureTags
    clinical_tags = $clinicalTags
    kcal_per_100 = Round-1 $energy
    protein_g_per_100 = Round-1 $protein
    carbs_g_per_100 = Round-1 $carbs
    fat_g_per_100 = Round-1 $fat
    sodium_mg_per_100 = [math]::Round($sodium, 0)
  })
}

$foods = $foods | Sort-Object name, food_id

$byName = @{}
foreach ($f in $foods) { if (-not $byName.ContainsKey($f.name)) { $byName[$f.name] = $f } }

$aliasSpecs = @(
  @{ local = "Ugali (maize meal equivalent)"; source = "Flour, corn, yellow, fine meal, enriched"; category = "starch" },
  @{ local = "Uji (sorghum porridge equivalent)"; source = "Sorghum flour, white, pearled, unenriched, dry, raw"; category = "broth" },
  @{ local = "Uji (millet porridge equivalent)"; source = "Millet, whole grain"; category = "broth" },
  @{ local = "Cassava meal equivalent"; source = "Flour, cassava"; category = "starch" },
  @{ local = "Matoke (plantain) equivalent"; source = "Plantains, underripe, raw"; category = "starch" },
  @{ local = "Tilapia fresh equivalent"; source = "Fish, tilapia, farm raised, raw"; category = "protein" },
  @{ local = "Sukuma wiki (collards) equivalent"; source = "Collards, raw"; category = "vegetable" },
  @{ local = "Kale (sukuma) equivalent"; source = "Kale, raw"; category = "vegetable" },
  @{ local = "Maharagwe (kidney beans) equivalent"; source = "Beans, Dry, Dark Red Kidney (0% moisture)"; category = "legume" },
  @{ local = "Ndengu (green gram) equivalent"; source = "Lentils, dry"; category = "legume" },
  @{ local = "Chapati flour equivalent"; source = "Flour, whole wheat, unenriched"; category = "grain" },
  @{ local = "Mchele brown rice equivalent"; source = "Rice, brown, long grain, unenriched, raw"; category = "grain" }
)

$aliases = New-Object System.Collections.Generic.List[object]
foreach ($spec in $aliasSpecs) {
  if (-not $byName.ContainsKey($spec.source)) { continue }
  $base = $byName[$spec.source]
  $tags = @("local_equivalent","usda_mapped","usda_verified")
  $aliases.Add([pscustomobject]@{
    food_id = ("local_" + ($spec.local.ToLowerInvariant() -replace "[^a-z0-9]+","_").Trim("_"))
    name = $spec.local
    category = $spec.category
    cuisine = "LOCAL_EQUIVALENT"
    texture_tags = $base.texture_tags
    clinical_tags = ($base.clinical_tags + $tags | Select-Object -Unique)
    kcal_per_100 = $base.kcal_per_100
    protein_g_per_100 = $base.protein_g_per_100
    carbs_g_per_100 = $base.carbs_g_per_100
    fat_g_per_100 = $base.fat_g_per_100
    sodium_mg_per_100 = $base.sodium_mg_per_100
  })
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("import type { SchemaFoodItem } from '../types';")
$lines.Add("")
$lines.Add("export const USDA_FOOD_DATASET_META = {")
$lines.Add("  provider: 'USDA FoodData Central',")
$lines.Add("  dataset: 'Foundation Foods CSV',")
$lines.Add("  release: '2025-12-18',")
$lines.Add("  sourceUrl: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2025-12-18.zip',")
$lines.Add("  generatedOn: '$((Get-Date).ToString('yyyy-MM-dd'))',")
$lines.Add("} as const;")
$lines.Add("")
$lines.Add("export const USDA_FOUNDATION_FOODS: readonly SchemaFoodItem[] = [")
foreach ($food in $foods) {
  $textureTags = ($food.texture_tags | ForEach-Object { "'$($_)'" }) -join ", "
  $clinicalTags = ($food.clinical_tags | ForEach-Object { "'$(Escape-SingleQuote $_)'" }) -join ", "
  $lines.Add("  { food_id: '$($food.food_id)', name: '$(Escape-SingleQuote $food.name)', category: '$($food.category)', cuisine: '$($food.cuisine)', texture_tags: [$textureTags], clinical_tags: [$clinicalTags], kcal_per_100: $($food.kcal_per_100), protein_g_per_100: $($food.protein_g_per_100), carbs_g_per_100: $($food.carbs_g_per_100), fat_g_per_100: $($food.fat_g_per_100), sodium_mg_per_100: $($food.sodium_mg_per_100) },")
}
$lines.Add("];")
$lines.Add("")
$lines.Add("export const LOCAL_EQUIVALENT_ALIASES: readonly SchemaFoodItem[] = [")
foreach ($alias in $aliases) {
  $textureTags = ($alias.texture_tags | ForEach-Object { "'$($_)'" }) -join ", "
  $clinicalTags = ($alias.clinical_tags | ForEach-Object { "'$(Escape-SingleQuote $_)'" }) -join ", "
  $lines.Add("  { food_id: '$($alias.food_id)', name: '$(Escape-SingleQuote $alias.name)', category: '$($alias.category)', cuisine: '$($alias.cuisine)', texture_tags: [$textureTags], clinical_tags: [$clinicalTags], kcal_per_100: $($alias.kcal_per_100), protein_g_per_100: $($alias.protein_g_per_100), carbs_g_per_100: $($alias.carbs_g_per_100), fat_g_per_100: $($alias.fat_g_per_100), sodium_mg_per_100: $($alias.sodium_mg_per_100) },")
}
$lines.Add("];")

Set-Content -Path $OutputFile -Value ($lines -join "`r`n") -Encoding UTF8

Write-Output "Generated $($foods.Count) USDA foods and $($aliases.Count) local equivalents."
Write-Output "Output: $OutputFile"
