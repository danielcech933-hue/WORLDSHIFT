local Workspace = game:GetService("Workspace")
local Lighting = game:GetService("Lighting")

local world = Workspace:WaitForChild("World")
local generated = world:FindFirstChild("HoshikawaGenerated") or Instance.new("Folder")
generated.Name = "HoshikawaGenerated"
generated.Parent = world

generated:ClearAllChildren()

local terrain = Workspace.Terrain

local function part(parent: Instance, name: string, size: Vector3, cframe: CFrame, color: Color3, material: Enum.Material, transparency: number?, shape: Enum.PartType?)
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.CFrame = cframe
	p.Anchored = true
	p.CanCollide = true
	p.CastShadow = true
	p.Color = color
	p.Material = material
	p.Transparency = transparency or 0
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	if shape then p.Shape = shape end
	p.Parent = parent
	return p
end

local function model(parent: Instance, name: string)
	local m = Instance.new("Model")
	m.Name = name
	m.Parent = parent
	return m
end

local function addTree(parent: Instance, position: Vector3, scale: number)
	local tree = model(parent, "SakuraTree")
	part(tree, "Trunk", Vector3.new(2.2, 9, 2.2) * scale, CFrame.new(position + Vector3.new(0, 4.5, 0)), Color3.fromRGB(92, 63, 48), Enum.Material.Wood)
	for i = 1, 7 do
		local angle = (i / 7) * math.pi * 2
		local offset = Vector3.new(math.cos(angle) * 3.2, 8.5 + (i % 2) * 1.1, math.sin(angle) * 3.2) * scale
		part(tree, "Blossom", Vector3.new(5.2, 4.2, 5.2) * scale, CFrame.new(position + offset), Color3.fromRGB(255, 168, 201), Enum.Material.SmoothPlastic, 0, Enum.PartType.Ball)
	end
	part(tree, "Crown", Vector3.new(6.8, 5.2, 6.8) * scale, CFrame.new(position + Vector3.new(0, 9.2, 0)), Color3.fromRGB(255, 192, 216), Enum.Material.SmoothPlastic, 0, Enum.PartType.Ball)
end

local function addHouse(parent: Instance, position: Vector3, rotation: number, width: number, depth: number)
	local house = model(parent, "HoshikawaHouse")
	local base = CFrame.new(position) * CFrame.Angles(0, rotation, 0)
	part(house, "Foundation", Vector3.new(width, 1.2, depth), base * CFrame.new(0, 0.6, 0), Color3.fromRGB(112, 105, 99), Enum.Material.Concrete)
	part(house, "Walls", Vector3.new(width - 1, 8, depth - 1), base * CFrame.new(0, 4.5, 0), Color3.fromRGB(232, 225, 211), Enum.Material.SmoothPlastic)
	part(house, "Roof", Vector3.new(width + 2, 1.2, depth + 2), base * CFrame.new(0, 9.1, 0), Color3.fromRGB(66, 70, 83), Enum.Material.Slate)
	part(house, "RoofTrim", Vector3.new(width + 2.4, 0.35, 0.45), base * CFrame.new(0, 9.8, -depth / 2), Color3.fromRGB(35, 39, 50), Enum.Material.Metal)
	for _, x in ipairs({-width * 0.25, width * 0.25}) do
		part(house, "Window", Vector3.new(width * 0.18, 2.2, 0.18), base * CFrame.new(x, 5.1, -depth / 2 - 0.05), Color3.fromRGB(123, 196, 214), Enum.Material.Glass, 0.2)
	end
end

local function addLamp(parent: Instance, position: Vector3)
	local lamp = model(parent, "StreetLamp")
	part(lamp, "Pole", Vector3.new(0.35, 7, 0.35), CFrame.new(position + Vector3.new(0, 3.5, 0)), Color3.fromRGB(40, 43, 51), Enum.Material.Metal)
	part(lamp, "Light", Vector3.new(1.5, 1.5, 1.5), CFrame.new(position + Vector3.new(0, 7.2, 0)), Color3.fromRGB(255, 221, 151), Enum.Material.Neon, 0, Enum.PartType.Ball)
	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(255, 218, 160)
	light.Range = 18
	light.Brightness = 1.2
	light.Parent = lamp:FindFirstChild("Light")
end

local function addTorii(parent: Instance, position: Vector3)
	local gate = model(parent, "ShrineTorii")
	local red = Color3.fromRGB(154, 37, 49)
	part(gate, "LeftPost", Vector3.new(1.4, 10, 1.4), CFrame.new(position + Vector3.new(-5, 5, 0)), red, Enum.Material.Wood)
	part(gate, "RightPost", Vector3.new(1.4, 10, 1.4), CFrame.new(position + Vector3.new(5, 5, 0)), red, Enum.Material.Wood)
	part(gate, "UpperBeam", Vector3.new(14, 1.2, 1.4), CFrame.new(position + Vector3.new(0, 10, 0)), red, Enum.Material.Wood)
	part(gate, "LowerBeam", Vector3.new(11, 0.9, 1.2), CFrame.new(position + Vector3.new(0, 7.7, 0)), red, Enum.Material.Wood)
	part(gate, "Crown", Vector3.new(16, 0.7, 1.7), CFrame.new(position + Vector3.new(0, 11, 0)), red, Enum.Material.Wood)
end

-- Ocean: scripted terrain keeps the environment editable and uses Roblox's native Water material.
terrain:FillBlock(CFrame.new(0, -10, 0), Vector3.new(900, 8, 900), Enum.Material.Water)
terrain.WaterColor = Color3.fromRGB(46, 137, 173)
terrain.WaterTransparency = 0.18
terrain.WaterReflectance = 0.35
terrain.WaterWaveSize = 0.35
terrain.WaterWaveSpeed = 8

-- Main island and soft hills.
terrain:FillBall(Vector3.new(0, -1, 0), 185, Enum.Material.Sand)
terrain:FillBall(Vector3.new(0, 4, 0), 155, Enum.Material.Grass)
terrain:FillBall(Vector3.new(-55, 10, 25), 58, Enum.Material.Grass)
terrain:FillBall(Vector3.new(62, 7, -28), 48, Enum.Material.Grass)
terrain:FillBall(Vector3.new(8, 9, -78), 42, Enum.Material.Grass)

-- Distant Fuji silhouette.
terrain:FillBall(Vector3.new(210, 42, -175), 72, Enum.Material.Rock)
terrain:FillBall(Vector3.new(210, 92, -175), 48, Enum.Material.Rock)
terrain:FillBall(Vector3.new(210, 132, -175), 20, Enum.Material.Snow)

local buildings = world:WaitForChild("Buildings")
local resources = world:WaitForChild("Resources")
local spawnFolder = world:WaitForChild("Spawn")

local roads = model(generated, "Roads")
part(roads, "MainStreet", Vector3.new(32, 0.5, 250), CFrame.new(0, 4.15, -8), Color3.fromRGB(61, 65, 74), Enum.Material.Asphalt)
part(roads, "HarborRoad", Vector3.new(220, 0.5, 24), CFrame.new(-10, 4.2, 88), Color3.fromRGB(61, 65, 74), Enum.Material.Asphalt)
part(roads, "ShrineRoad", Vector3.new(20, 0.5, 145), CFrame.new(-70, 4.2, -35), Color3.fromRGB(72, 74, 78), Enum.Material.Concrete)

local town = model(generated, "Town")
addHouse(town, Vector3.new(42, 5, -35), math.rad(180), 20, 18)
addHouse(town, Vector3.new(42, 5, 5), math.rad(180), 24, 20)
addHouse(town, Vector3.new(-42, 5, -38), 0, 18, 18)
addHouse(town, Vector3.new(-42, 5, 3), 0, 22, 18)
addHouse(town, Vector3.new(48, 5, 42), math.rad(180), 18, 16)

for _, z in ipairs({-80, -35, 10, 55, 95}) do
	addLamp(generated, Vector3.new(-19, 4, z))
	addLamp(generated, Vector3.new(19, 4, z))
end

local harbor = model(generated, "Harbor")
part(harbor, "Pier", Vector3.new(18, 1.2, 75), CFrame.new(72, 2.2, 88), Color3.fromRGB(117, 82, 54), Enum.Material.WoodPlanks)
for _, z in ipairs({58, 80, 102, 124}) do
	part(harbor, "Post", Vector3.new(1.5, 8, 1.5), CFrame.new(65, -1, z), Color3.fromRGB(89, 61, 42), Enum.Material.Wood)
	part(harbor, "Post", Vector3.new(1.5, 8, 1.5), CFrame.new(79, -1, z), Color3.fromRGB(89, 61, 42), Enum.Material.Wood)
end

local shrine = model(generated, "OldShrine")
addTorii(shrine, Vector3.new(-70, 4, -108))
part(shrine, "Platform", Vector3.new(48, 1.5, 34), CFrame.new(-70, 5, -126), Color3.fromRGB(108, 91, 78), Enum.Material.WoodPlanks)
part(shrine, "Hall", Vector3.new(28, 13, 18), CFrame.new(-70, 12, -129), Color3.fromRGB(131, 53, 48), Enum.Material.Wood)
part(shrine, "HallRoof", Vector3.new(34, 2, 24), CFrame.new(-70, 19, -129), Color3.fromRGB(39, 43, 52), Enum.Material.Slate)

for _, data in ipairs({
	{Vector3.new(-110, 5, -75), 1.2}, {Vector3.new(-98, 5, -38), 1.0}, {Vector3.new(-88, 5, 18), 1.25},
	{Vector3.new(85, 5, -72), 1.0}, {Vector3.new(100, 5, -25), 1.2}, {Vector3.new(105, 5, 35), 0.9},
	{Vector3.new(-20, 5, -145), 1.0}, {Vector3.new(20, 5, -145), 1.15}, {Vector3.new(118, 5, 72), 1.0},
}) do
	addTree(resources, data[1], data[2])
end

local spawn = spawnFolder:FindFirstChild("HoshikawaSpawn") or Instance.new("SpawnLocation")
spawn.Name = "HoshikawaSpawn"
spawn.Size = Vector3.new(8, 1, 8)
spawn.CFrame = CFrame.new(0, 5.2, 72)
spawn.Anchored = true
spawn.Neutral = true
spawn.Transparency = 1
spawn.CanCollide = false
spawn.Parent = spawnFolder

Lighting.ClockTime = 17.4
Lighting.Brightness = 2.2
Lighting.ExposureCompensation = 0.15
Lighting.Ambient = Color3.fromRGB(120, 128, 150)
Lighting.OutdoorAmbient = Color3.fromRGB(90, 103, 132)

local atmosphere = Lighting:FindFirstChild("HoshikawaAtmosphere") or Instance.new("Atmosphere")
atmosphere.Name = "HoshikawaAtmosphere"
atmosphere.Density = 0.22
atmosphere.Offset = 0.15
atmosphere.Color = Color3.fromRGB(188, 205, 230)
atmosphere.Decay = Color3.fromRGB(111, 123, 160)
atmosphere.Glare = 0.18
atmosphere.Haze = 1.1
atmosphere.Parent = Lighting

print("[WORLDSHIFT] Hoshikawa environment generated: ocean, island, town, harbor, shrine, sakura grove and Fuji backdrop.")
