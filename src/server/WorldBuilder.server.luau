local Workspace = game:GetService("Workspace")

local world = Workspace:WaitForChild("World")
local buildings = world:WaitForChild("Buildings")
local interactables = world:WaitForChild("Interactables")
local spawnFolder = world:WaitForChild("Spawn")
local npcs = world:WaitForChild("NPCs")

local function part(parent: Instance, name: string, size: Vector3, position: Vector3, material: Enum.Material, transparency: number?, color: Color3?): Part
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.Position = position
	p.Anchored = true
	p.Material = material
	p.Transparency = transparency or 0
	if color then
		p.Color = color
	end
	p.Parent = parent
	return p
end

local function makeLabel(parent: Instance, text: string, offset: Vector3)
	local gui = Instance.new("BillboardGui")
	gui.Name = "WorldLabel"
	gui.Size = UDim2.fromOffset(360, 70)
	gui.StudsOffsetWorldSpace = offset
	gui.AlwaysOnTop = true
	gui.Parent = parent

	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Text = text
	label.TextScaled = true
	label.Font = Enum.Font.GothamBold
	label.TextColor3 = Color3.new(1, 1, 1)
	label.TextStrokeTransparency = 0.35
	label.Parent = gui
end

if not buildings:FindFirstChild("HoshikawaArrival") then
	part(buildings, "HoshikawaArrival", Vector3.new(70, 2, 70), Vector3.new(0, -1, 0), Enum.Material.Grass, 0, Color3.fromRGB(82, 130, 76))
	part(buildings, "ArrivalStone", Vector3.new(18, 1, 18), Vector3.new(0, 1, 0), Enum.Material.Slate, 0, Color3.fromRGB(115, 115, 125))
	part(buildings, "Road", Vector3.new(14, 0.2, 70), Vector3.new(0, 2, 0), Enum.Material.Concrete, 0, Color3.fromRGB(155, 155, 155))
	part(buildings, "RoadCross", Vector3.new(70, 0.2, 14), Vector3.new(0, 2.05, 0), Enum.Material.Concrete, 0, Color3.fromRGB(155, 155, 155))

	local sign = part(interactables, "HoshikawaSign", Vector3.new(12, 5, 1), Vector3.new(0, 7, -25), Enum.Material.Wood, 0, Color3.fromRGB(110, 70, 45))
	makeLabel(sign, "HOSHIKAWA\nAnime Reality", Vector3.new(0, 4, 0))
end

if not spawnFolder:FindFirstChild("HoshikawaSpawn") then
	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "HoshikawaSpawn"
	spawn.Size = Vector3.new(8, 1, 8)
	spawn.Position = Vector3.new(0, 3, 0)
	spawn.Anchored = true
	spawn.Neutral = true
	spawn.Transparency = 0.35
	spawn.Parent = spawnFolder
end

if not npcs:FindFirstChild("Guide") then
	local model = Instance.new("Model")
	model.Name = "Guide"
	model.Parent = npcs

	local root = part(model, "HumanoidRootPart", Vector3.new(2, 2, 1), Vector3.new(0, 4, -12), Enum.Material.SmoothPlastic, 1)
	root.CanCollide = false

	local body = part(model, "Body", Vector3.new(2.5, 3, 1.4), Vector3.new(0, 5.5, -12), Enum.Material.SmoothPlastic, 0, Color3.fromRGB(35, 42, 62))
	body.CanCollide = false

	local head = part(model, "Head", Vector3.new(2.2, 2.2, 2.2), Vector3.new(0, 8, -12), Enum.Material.SmoothPlastic, 0, Color3.fromRGB(235, 205, 175))
	head.Shape = Enum.PartType.Ball
	head.CanCollide = false

	local halo = part(model, "Halo", Vector3.new(4, 0.25, 4), Vector3.new(0, 10, -12), Enum.Material.Neon, 0.15, Color3.fromRGB(220, 230, 255))
	halo.Shape = Enum.PartType.Cylinder
	halo.CanCollide = false

	local humanoid = Instance.new("Humanoid")
	humanoid.DisplayName = "The Guide"
	humanoid.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff
	humanoid.Parent = model

	model.PrimaryPart = root
	makeLabel(head, "THE GUIDE", Vector3.new(0, 2.5, 0))
end

print("[WORLDSHIFT] Hoshikawa arrival scene ready")
