local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer

local function createHud()
	local gui = Instance.new("ScreenGui")
	gui.Name = "WorldShiftHUD"
	gui.ResetOnSpawn = false
	gui.Parent = player:WaitForChild("PlayerGui")

	local title = Instance.new("TextLabel")
	title.Name = "Title"
	title.Size = UDim2.fromOffset(420, 54)
	title.Position = UDim2.fromOffset(24, 24)
	title.BackgroundTransparency = 1
	title.Text = "WORLDSHIFT"
	title.TextSize = 30
	title.Font = Enum.Font.GothamBold
	title.TextXAlignment = Enum.TextXAlignment.Left
	title.Parent = gui

	local location = Instance.new("TextLabel")
	location.Name = "Location"
	location.Size = UDim2.fromOffset(420, 32)
	location.Position = UDim2.fromOffset(26, 72)
	location.BackgroundTransparency = 1
	location.Text = "Anime Reality • Hoshikawa"
	location.TextSize = 17
	location.Font = Enum.Font.Gotham
	location.TextXAlignment = Enum.TextXAlignment.Left
	location.Parent = gui
end

createHud()
print("[WORLDSHIFT] Client ready for", player.Name)
