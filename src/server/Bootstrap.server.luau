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

	local selectWorld = remotes:FindFirstChild("SelectStartingWorld")
	if not selectWorld then
		selectWorld = Instance.new("RemoteEvent")
		selectWorld.Name = "SelectStartingWorld"
		selectWorld.Parent = remotes
	end
	return selectWorld
end

local function setupPlayer(player: Player)
	player:SetAttribute("WorldShiftReady", true)
	player:SetAttribute("Reality", "Unchosen")
	player:SetAttribute("Location", "Between Worlds")
	player:SetAttribute("StartingWorldChosen", false)
end

createRuntimeFolders()
local selectWorld = createRemoteFolder()

selectWorld.OnServerEvent:Connect(function(player: Player, reality: string)
	if player:GetAttribute("StartingWorldChosen") then
		return
	end

	if reality ~= "Anime" and reality ~= "Movie" then
		return
	end

	player:SetAttribute("Reality", reality)
	player:SetAttribute("StartingWorldChosen", true)

	if reality == "Anime" then
		player:SetAttribute("Location", "Hoshikawa")
	else
		player:SetAttribute("Location", "Metrovale")
	end

	local character = player.Character
	if character then
		local target = reality == "Anime"
			and CFrame.new(0, 5, 8)
			or CFrame.new(150, 5, 8)
		character:PivotTo(target)
	end

	print(string.format("[WORLDSHIFT] %s chose %s Reality", player.Name, reality))
end)

Players.PlayerAdded:Connect(setupPlayer)
for _, player in Players:GetPlayers() do
	setupPlayer(player)
end

print(string.format("[WORLDSHIFT] Server ready — v%s", Config.Version))
