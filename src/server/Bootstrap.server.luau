local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)

local function createRuntimeFolders()
	local world = workspace:FindFirstChild("World") or Instance.new("Folder")
	world.Name = "World"
	world.Parent = workspace

	for _, name in { "NPCs", "Enemies", "Interactables", "Buildings", "Resources", "Spawn" } do
		local folder = world:FindFirstChild(name) or Instance.new("Folder")
		folder.Name = name
		folder.Parent = world
	end
end

local function createRemoteFolder()
	local remotes = ReplicatedStorage:FindFirstChild("Remotes") or Instance.new("Folder")
	remotes.Name = "Remotes"
	remotes.Parent = ReplicatedStorage
end

local function setupPlayer(player: Player)
	player:SetAttribute("WorldShiftReady", true)
	player:SetAttribute("Reality", Config.StartingReality)
	player:SetAttribute("Location", Config.StartingLocation)
end

createRuntimeFolders()
createRemoteFolder()

Players.PlayerAdded:Connect(setupPlayer)
for _, player in Players:GetPlayers() do
	setupPlayer(player)
end

print(string.format("[WORLDSHIFT] Server ready — v%s — %s / %s", Config.Version, Config.StartingReality, Config.StartingLocation))
