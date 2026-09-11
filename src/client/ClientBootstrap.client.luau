local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera
local Dialogue = require(ReplicatedStorage.Shared.IntroDialogue)

local function createGui(name: string): ScreenGui
	local gui = Instance.new("ScreenGui")
	gui.Name = name
	gui.ResetOnSpawn = false
	gui.IgnoreGuiInset = true
	gui.DisplayOrder = 100
	gui.Parent = player:WaitForChild("PlayerGui")
	return gui
end

local function tween(instance: Instance, duration: number, properties: {[string]: any})
	local info = TweenInfo.new(duration, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
	local t = TweenService:Create(instance, info, properties)
	t:Play()
	t.Completed:Wait()
end

local function createHud()
	local gui = createGui("WorldShiftHUD")

	local title = Instance.new("TextLabel")
	title.Name = "Title"
	title.Size = UDim2.fromOffset(500, 54)
	title.Position = UDim2.fromOffset(24, 24)
	title.BackgroundTransparency = 1
	title.Text = "WORLDSHIFT"
	title.TextSize = 30
	title.Font = Enum.Font.GothamBold
	title.TextXAlignment = Enum.TextXAlignment.Left
	title.TextTransparency = 1
	title.Parent = gui

	local location = Instance.new("TextLabel")
	location.Name = "Location"
	location.Size = UDim2.fromOffset(500, 32)
	location.Position = UDim2.fromOffset(26, 72)
	location.BackgroundTransparency = 1
	location.Text = "Anime Reality  •  Hoshikawa"
	location.TextSize = 17
	location.Font = Enum.Font.Gotham
	location.TextXAlignment = Enum.TextXAlignment.Left
	location.TextTransparency = 1
	location.Parent = gui

	tween(title, 0.8, {TextTransparency = 0})
	tween(location, 0.8, {TextTransparency = 0})
end

local function createIntro()
	local gui = createGui("WorldShiftIntro")

	local fade = Instance.new("Frame")
	fade.Name = "Fade"
	fade.Size = UDim2.fromScale(1, 1)
	fade.BackgroundColor3 = Color3.new(0, 0, 0)
	fade.BackgroundTransparency = 0
	fade.Parent = gui

	local title = Instance.new("TextLabel")
	title.Size = UDim2.fromOffset(700, 100)
	title.Position = UDim2.fromScale(0.5, 0.38)
	title.AnchorPoint = Vector2.new(0.5, 0.5)
	title.BackgroundTransparency = 1
	title.Text = "WORLDSHIFT"
	title.Font = Enum.Font.GothamBold
	title.TextSize = 52
	title.TextTransparency = 1
	title.Parent = fade

	local subtitle = Instance.new("TextLabel")
	subtitle.Size = UDim2.fromOffset(700, 50)
	subtitle.Position = UDim2.fromScale(0.5, 0.48)
	subtitle.AnchorPoint = Vector2.new(0.5, 0.5)
	subtitle.BackgroundTransparency = 1
	subtitle.Text = "One player. Infinite worlds."
	subtitle.Font = Enum.Font.Gotham
	subtitle.TextSize = 21
	subtitle.TextTransparency = 1
	subtitle.Parent = fade

	local prompt = Instance.new("TextLabel")
	prompt.Size = UDim2.fromOffset(700, 45)
	prompt.Position = UDim2.fromScale(0.5, 0.82)
	prompt.AnchorPoint = Vector2.new(0.5, 0.5)
	prompt.BackgroundTransparency = 1
	prompt.Text = "CLICK OR PRESS SPACE TO CONTINUE"
	prompt.Font = Enum.Font.GothamMedium
	prompt.TextSize = 16
	prompt.TextTransparency = 1
	prompt.Parent = fade

	local function showText(label: TextLabel, duration: number)
		tween(label, duration, {TextTransparency = 0})
	end

	task.wait(1.2)
	showText(title, 1.2)
	task.wait(0.3)
	showText(subtitle, 1)
	task.wait(1)

	-- A short visual "blink" before the Guide appears.
	for _ = 1, 2 do
		tween(fade, 0.12, {BackgroundTransparency = 0.72})
		tween(fade, 0.12, {BackgroundTransparency = 0.15})
	end

	tween(prompt, 0.7, {TextTransparency = 0})

	local continue = false
	local connection = UserInputService.InputBegan:Connect(function(input, processed)
		if processed then
			return
		end
		if input.KeyCode == Enum.KeyCode.Space or input.UserInputType == Enum.UserInputType.MouseButton1 then
			continue = true
		end
	end)

	while not continue do
		task.wait()
	end
	connection:Disconnect()
	return gui, fade
end

local function runDialogue(introGui: ScreenGui, fade: Frame)
	local guide = workspace:WaitForChild("World"):WaitForChild("NPCs"):WaitForChild("Guide")
	local guideHead = guide:WaitForChild("Head")

	camera.CameraType = Enum.CameraType.Scriptable
	local target = guideHead.Position + Vector3.new(0, 0.3, 0)
	camera.CFrame = CFrame.lookAt(target + Vector3.new(9, 4, 12), target)

	local dialogue = Instance.new("Frame")
	dialogue.Name = "Dialogue"
	dialogue.Size = UDim2.fromScale(0.72, 0.19)
	dialogue.Position = UDim2.fromScale(0.5, 0.84)
	dialogue.AnchorPoint = Vector2.new(0.5, 0.5)
	dialogue.BackgroundColor3 = Color3.fromRGB(12, 15, 25)
	dialogue.BackgroundTransparency = 0.12
	dialogue.BorderSizePixel = 0
	dialogue.Parent = introGui

	local name = Instance.new("TextLabel")
	name.Size = UDim2.fromScale(0.24, 0.3)
	name.Position = UDim2.fromScale(0.035, 0.08)
	name.BackgroundTransparency = 1
	name.Text = Dialogue.GuideName
	name.Font = Enum.Font.GothamBold
	name.TextSize = 19
	name.TextXAlignment = Enum.TextXAlignment.Left
	name.Parent = dialogue

	local text = Instance.new("TextLabel")
	text.Size = UDim2.fromScale(0.9, 0.5)
	text.Position = UDim2.fromScale(0.035, 0.36)
	text.BackgroundTransparency = 1
	text.Text = ""
	text.Font = Enum.Font.Gotham
	text.TextSize = 21
	text.TextWrapped = true
	text.TextXAlignment = Enum.TextXAlignment.Left
	text.Parent = dialogue

	fade.BackgroundTransparency = 0.15
	tween(fade, 1.0, {BackgroundTransparency = 1})

	local function waitAdvance()
		local advanced = false
		local connection = UserInputService.InputBegan:Connect(function(input, processed)
			if processed then
				return
			end
			if input.KeyCode == Enum.KeyCode.Space or input.UserInputType == Enum.UserInputType.MouseButton1 then
				advanced = true
			end
		end)
		while not advanced do
			task.wait()
		end
		connection:Disconnect()
	end

	for index, line in ipairs(Dialogue.Lines) do
		text.Text = line
		if index < #Dialogue.Lines then
			waitAdvance()
		end
	end

	task.wait(0.6)
	tween(dialogue, 0.7, {BackgroundTransparency = 1})
	tween(text, 0.5, {TextTransparency = 1})
	tween(name, 0.5, {TextTransparency = 1})
	task.wait(0.2)
	introGui:Destroy()

	camera.CameraType = Enum.CameraType.Custom
	local character = player.Character or player.CharacterAdded:Wait()
	local humanoid = character:WaitForChild("Humanoid")
	camera.CameraSubject = humanoid

	createHud()
	print("[WORLDSHIFT] Opening complete")
end

local function main()
	local introGui, fade = createIntro()
	runDialogue(introGui, fade)
	print("[WORLDSHIFT] Client ready for", player.Name)
end

main()
