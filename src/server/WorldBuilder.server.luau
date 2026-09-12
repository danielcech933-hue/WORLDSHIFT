local Workspace = game:GetService("Workspace")
local RunService = game:GetService("RunService")

local world = Workspace:WaitForChild("World")
local npcs = world:WaitForChild("NPCs")

local function part(parent: Instance, name: string, size: Vector3, position: Vector3, material: Enum.Material, transparency: number?, color: Color3?): Part
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.Position = position
	p.Anchored = true
	p.Transparency = transparency or 0
	p.Material = material
	p.CanCollide = false
	p.CastShadow = true
	if color then p.Color = color end
	p.Parent = parent
	return p
end

-- The Guide is a cinematic character, not a floating world label.
-- World/location names belong in the cinematic UI and HUD, never above 3D objects.
if not npcs:FindFirstChild("Guide") then
	local model = Instance.new("Model")
	model.Name = "Guide"
	model.Parent = npcs

	local root = part(model, "HumanoidRootPart", Vector3.new(2, 2, 1), Vector3.new(0, 4, -12), Enum.Material.SmoothPlastic, 1)
	local body = part(model, "Body", Vector3.new(2.5, 3, 1.4), Vector3.new(0, 5.5, -12), Enum.Material.SmoothPlastic, 0, Color3.fromRGB(35, 42, 62))
	local head = part(model, "Head", Vector3.new(2.2, 2.2, 2.2), Vector3.new(0, 8, -12), Enum.Material.SmoothPlastic, 0, Color3.fromRGB(235, 205, 175))
	head.Shape = Enum.PartType.Ball
	local halo = part(model, "Halo", Vector3.new(4, 0.25, 4), Vector3.new(0, 10, -12), Enum.Material.Neon, 0.15, Color3.fromRGB(220, 230, 255))
	halo.Shape = Enum.PartType.Cylinder

	local humanoid = Instance.new("Humanoid")
	humanoid.DisplayName = ""
	humanoid.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff
	humanoid.NameDisplayDistance = 0
	humanoid.Parent = model

	model.PrimaryPart = root
end

local guide = npcs:WaitForChild("Guide")
local basePivot = guide:GetPivot()
local elapsed = 0
RunService.Heartbeat:Connect(function(dt)
	if not guide.Parent then return end
	elapsed += dt
	local y = math.sin(elapsed * 1.4) * 0.18
	guide:PivotTo(basePivot * CFrame.new(0, y, 0))
end)

print("[WORLDSHIFT] Guide runtime ready — cinematic labels disabled")
