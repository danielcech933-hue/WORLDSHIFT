local Constants = {
	Realities = {
		Anime = "Anime",
		Movie = "Movie",
		Series = "Series",
	},

	Classes = {
		Adventurer = "Adventurer",
		Warrior = "Warrior",
		Ninja = "Ninja",
		Ranger = "Ranger",
		Mage = "Mage",
		Guardian = "Guardian",
		Chef = "Chef",
		Musician = "Musician",
		Mangaka = "Mangaka",
	},

	Rarities = {
		Common = "Common",
		Uncommon = "Uncommon",
		Rare = "Rare",
		Epic = "Epic",
		Legendary = "Legendary",
		Mythic = "Mythic",
		Relic = "Relic",
		World = "World",
	},

	MasteryRanks = {
		{ Min = 1, Max = 4, Name = "Beginner" },
		{ Min = 5, Max = 9, Name = "Apprentice" },
		{ Min = 10, Max = 24, Name = "Skilled" },
		{ Min = 25, Max = 49, Name = "Professional" },
		{ Min = 50, Max = 74, Name = "Expert" },
		{ Min = 75, Max = 99, Name = "Master" },
		{ Min = 100, Max = math.huge, Name = "Legendary" },
	},
}

return Constants
