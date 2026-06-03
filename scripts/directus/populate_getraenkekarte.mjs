import { directusRequest } from "./client.mjs";

const menuData = [
  {
    category: "Bier",
    icon: "beer",
    sort: 10,
    drinks: [
      {
        name: "Bier, Radler",
        sort: 10,
        prices: [
          { size: "1,0", unit: "l", price: "5,70" },
          { size: "0,5", unit: "l", price: "3,00" },
          { size: "0,25", unit: "l", price: "1,70" }
        ]
      },
      {
        name: "Leichtbier",
        sort: 20,
        prices: [
          { size: "0,5", unit: "l", price: "3,00" }
        ]
      },
      {
        name: "alkoholfr. Bier, alkoholfr. Weizen",
        sort: 30,
        prices: [
          { size: "0,5", unit: "l", price: "3,00" }
        ]
      }
    ]
  },
  {
    category: "Alkoholfreie Getränke",
    icon: "bottle",
    sort: 20,
    drinks: [
      {
        name: "Limo, Spezi, Cola",
        sort: 10,
        prices: [
          { size: "0,5", unit: "l", price: "2,50" }
        ]
      },
      {
        name: "Apfelsaftschorle",
        sort: 20,
        prices: [
          { size: "0,5", unit: "l", price: "2,50" }
        ]
      },
      {
        name: "Iso Kirschschorle",
        sort: 30,
        prices: [
          { size: "0,5", unit: "l", price: "2,50" }
        ]
      },
      {
        name: "Mineralwasser",
        sort: 40,
        prices: [
          { size: "0,5", unit: "l", price: "2,50" }
        ]
      }
    ]
  },
  {
    category: "Wein und Spirituosen",
    icon: "glass",
    sort: 30,
    drinks: [
      {
        name: "Frankenwein",
        sort: 10,
        prices: [
          { size: "0,2", unit: "l", price: "2,70" },
          { size: "0,1", unit: "l", price: "1,40" }
        ]
      },
      {
        name: "Weinschorle",
        sort: 20,
        prices: [
          { size: "0,5", unit: "l", price: "3,50" },
          { size: "0,25", unit: "l", price: "1,80" }
        ]
      },
      {
        name: "Schnaps",
        sort: 30,
        prices: [
          { size: "0,02", unit: "l", price: "1,50" }
        ]
      }
    ]
  }
];

async function run() {
  console.log("Populating drinks menu (Getränkekarte) in CMS...");

  // Fetch existing categories to avoid duplicates
  const existingCategories = await directusRequest("/items/drink_categories");
  const existingCategoryMap = new Map(existingCategories.map(c => [c.name, c.id]));

  for (const group of menuData) {
    let categoryId = existingCategoryMap.get(group.category);

    if (!categoryId) {
      console.log(`Creating category: ${group.category}...`);
      const catResult = await directusRequest("/items/drink_categories", {
        method: "POST",
        body: {
          name: group.category,
          icon: group.icon,
          sort: group.sort
        }
      });
      categoryId = catResult.id;
      console.log(`Category '${group.category}' created with ID: ${categoryId}`);
    } else {
      console.log(`Category '${group.category}' already exists with ID: ${categoryId}`);
      // Update icon and sort just in case
      await directusRequest(`/items/drink_categories/${categoryId}`, {
        method: "PATCH",
        body: {
          icon: group.icon,
          sort: group.sort
        }
      });
    }

    // Now insert drinks for this category
    // Fetch existing drinks for this category
    const existingDrinks = await directusRequest("/items/drinks", {
      query: {
        filter: {
          category: {
            _eq: categoryId
          }
        }
      }
    });
    const existingDrinksMap = new Map(existingDrinks.map(d => [d.name, d.id]));

    for (const drink of group.drinks) {
      const drinkId = existingDrinksMap.get(drink.name);

      if (!drinkId) {
        console.log(`Creating drink: ${drink.name}...`);
        await directusRequest("/items/drinks", {
          method: "POST",
          body: {
            name: drink.name,
            sort: drink.sort,
            category: categoryId,
            prices: drink.prices
          }
        });
      } else {
        console.log(`Drink '${drink.name}' already exists. Updating prices and sort...`);
        await directusRequest(`/items/drinks/${drinkId}`, {
          method: "PATCH",
          body: {
            sort: drink.sort,
            prices: drink.prices
          }
        });
      }
    }
  }

  console.log("Drinks menu populated successfully!");
}

run().catch(console.error);
