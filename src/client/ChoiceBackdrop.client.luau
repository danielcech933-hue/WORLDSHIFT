local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local Lighting = game:GetService("Lighting")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local function protectChoice(gui: ScreenGui)
	-- The world-selection screen is a separate cinematic layer.
	-- Nothing from the 3D intro scene should remain visible behind it.
	local background = gui:FindFirstChildWhichIsA("Frame")
	if background then
		background.ZIndex = 0
		background.BackgroundTransparency = 0
		background.BackgroundColor3 = Color3.fromRGB(4, 6, 12)
	end

	for _, object in ipairs(gui:GetDescendants()) do
		if object:IsA("GuiObject") and object ~= background then
			object.ZIndex = math.max(object.ZIndex, 10)
		end
	end

	local hud = playerGui:FindFirstChild("WorldShiftHUD")
	if hud then
		hud.Enabled = false
	end

	local intro = playerGui:FindFirstChild("WorldShiftIntro")
	if intro then
		intro.Enabled = false
	end

	local blur = Lighting:FindFirstChild("WorldShiftChoiceBlur")
	if blur and blur:IsA("BlurEffect") then
		blur.Size = 18
	end
end

local function watch()
	local existing = playerGui:FindFirstChild("WorldShiftChoice")
	if existing and existing:IsA("ScreenGui") then
		protectChoice(existing)
	end

	playerGui.ChildAdded:Connect(function(child)
		if child.Name ~= "WorldShiftChoice" or not child:IsA("ScreenGui") then
			return
		end

		task.defer(function()
			protectChoice(child)
		end)

		-- The original choice UI fades its backdrop in. Keep it opaque so the
		-- previous Hoshikawa scene never bleeds through during the transition.
		task.delay(0.05, function()
			if child.Parent then
				protectChoice(child)
			end
		end)
	end)
end

watch()
