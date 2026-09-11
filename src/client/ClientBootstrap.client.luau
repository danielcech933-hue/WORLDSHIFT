local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera
local Dialogue = require(ReplicatedStorage.Shared.IntroDialogue)

local function destroyOldUi()
	local playerGui = player:WaitForChild("PlayerGui")
	for _, name in { "WorldShiftHUD", "WorldShiftIntro" } do
		local old = playerGui:FindFirstChild(name)
		if old then
			old:Destroy()
		end
	end
end

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
	local animation = TweenService:Create(instance, info, properties)
	animation:Play()
	animation.Completed:Wait()
end

local function createHud()
	local gui = createGui("WorldShiftHUD")

	local title = Instance.new("TextLabel")
	title.Name = "Title"
	title.Size = UDim2.fromOffset(500, 48)
	title.Position = UDim2.fromOffset(28, 24)
	title.BackgroundTransparency = 1
	title.Text = "WORLDSHIFT"
	title.TextColor3 = Color3.fromRGB(245, 247, 255)
	title.TextSize = 30
	title.Font = Enum.Font.GothamBold
	title.TextXAlignment = Enum.TextXAlignment.Left
	title.TextTransparency = 1
	title.Parent = gui

	local location = Instance.new("TextLabel")
	location.Name = "Location"
	location.Size = UDim2.fromOffset(500, 30)
	location.Position = UDim2.fromOffset(30, 68)
	location.BackgroundTransparency = 1
	location.Text = "ANIME REALITY  •  HOSHIKAWA"
	location.TextColor3 = Color3.fromRGB(205, 214, 235)
	location.TextSize = 16
	location.Font = Enum.Font.GothamMedium
	location.TextXAlignment = Enum.TextXAlignment.Left
	location.TextTransparency = 1
	location.Parent = gui

	task.spawn(function()
		tween(title, 0.7, {TextTransparency = 0})
	end)
	task.wait(0.15)
	tween(location, 0.7, {TextTransparency = 0})
end

local function createIntro()
	local gui = createGui("WorldShiftIntro")

	local fade = Instance.new("Frame")
	fade.Name = "Fade"
	fade.Size = UDim2.fromScale(1, 1)
	fade.BackgroundColor3 = Color3.new(0, 0, 0)
	fade.BackgroundTransparency = 0
	fade.BorderSizePixel = 0
	fade.Parent = gui

	local title = Instance.new("TextLabel")
	title.Size = UDim2.fromOffset(760, 90)
	title.Position = UDim2.fromScale(0.5, 0.40)
	title.AnchorPoint = Vector2.new(0.5, 0.5)
	title.BackgroundTransparency = 1
	title.Text = "WORLDSHIFT"
	title.TextColor3 = Color3.fromRGB(245, 247, 255)
	title.Font = Enum.Font.GothamBold
	title.TextSize = 54
	title.TextTransparency = 1
	title.Parent = fade

	local subtitle = Instance.new("TextLabel")
	subtitle.Size = UDim2.fromOffset(760, 50)
	subtitle.Position = UDim2.fromScale(0.5, 0.49)
	subtitle.AnchorPoint = Vector2.new(0.5, 0.5)
	subtitle.BackgroundTransparency = 1
	subtitle.Text = "One player. Infinite worlds."
	subtitle.TextColor3 = Color3.fromRGB(200, 207, 225)
	subtitle.Font = Enum.Font.Gotham
	subtitle.TextSize = 21
	subtitle.TextTransparency = 1
	subtitle.Parent = fade

	local prompt = Instance.new("TextLabel")
	prompt.Size = UDim2.fromOffset(760, 45)
	prompt.Position = UDim2.fromScale(0.5, 0.84)
	prompt.AnchorPoint = Vector2.new(0.5, 0.5)
	prompt.BackgroundTransparency = 1
	prompt.Text = "CLICK OR PRESS SPACE TO CONTINUE"
	prompt.TextColor3 = Color3.fromRGB(180, 190, 215)
	prompt.Font = Enum.Font.GothamMedium
	prompt.TextSize = 15
	prompt.TextTransparency = 1
	prompt.Parent = fade

	task.wait(1.0)
	tween(title, 1.1, {TextTransparency = 0})
	task.wait(0.25)
	tween(subtitle, 0.9, {TextTransparency = 0})
	task.wait(0.7)

	for _ = 1, 2 do
		tween(fade, 0.10, {BackgroundTransparency = 0.82})
		tween(fade, 0.14, {BackgroundTransparency = 0.12})
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
	local world = workspace:WaitForChild("World")
	local guide = world:WaitForChild("NPCs"):WaitForChild("Guide")
	local guideHead = guide:WaitForChild("Head")

	camera.CameraType = Enum.CameraType.Scriptable
	local target = guideHead.Position + Vector3.new(0, 0.4, 0)
	camera.CFrame = CFrame.lookAt(target + Vector3.new(8, 3.2, 10), target)

	-- Remove the opening title before dialogue so no layers can overlap.
	for _, child in ipairs(introGui:GetChildren()) do
		if child ~= fade then
			child:Destroy()
		end
	end
	fade.BackgroundTransparency = 1

	local dialogue = Instance.new("Frame")
	dialogue.Name = "Dialogue"
	dialogue.Size = UDim2.fromScale(0.76, 0.205)
	dialogue.Position = UDim2.fromScale(0.5, 0.82)
	dialogue.AnchorPoint = Vector2.new(0.5, 0.5)
	dialogue.BackgroundColor3 = Color3.fromRGB(10, 13, 22)
	dialogue.BackgroundTransparency = 0.08
	dialogue.BorderSizePixel = 0
	dialogue.Parent = introGui

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 14)
	corner.Parent = dialogue

	local stroke = Instance.new("UIStroke")
	stroke.Color = Color3.fromRGB(105, 120, 155)
	stroke.Transparency = 0.45
	stroke.Thickness = 1
	stroke.Parent = dialogue

	local name = Instance.new("TextLabel")
	name.Size = UDim2.fromScale(0.88, 0.22)
	name.Position = UDim2.fromScale(0.06, 0.10)
	name.BackgroundTransparency = 1
	name.Text = Dialogue.GuideName
	name.TextColor3 = Color3.fromRGB(235, 240, 255)
	name.Font = Enum.Font.GothamBold
	name.TextSize = 18
	name.TextXAlignment = Enum.TextXAlignment.Left
	name.Parent = dialogue

	local text = Instance.new("TextLabel")
	text.Size = UDim2.fromScale(0.88, 0.43)
	text.Position = UDim2.fromScale(0.06, 0.36)
	text.BackgroundTransparency = 1
	text.Text = ""
	text.TextColor3 = Color3.fromRGB(222, 228, 242)
	text.Font = Enum.Font.Gotham
	text.TextSize = 20
	text.TextWrapped = true
	text.TextXAlignment = Enum.TextXAlignment.Left
	text.TextYAlignment = Enum.TextYAlignment.Top
	text.Parent = dialogue

	local hint = Instance.new("TextLabel")
	hint.Size = UDim2.fromScale(0.88, 0.14)
	hint.Position = UDim2.fromScale(0.06, 0.80)
	hint.BackgroundTransparency = 1
	hint.Text = "SPACE / CLICK  •  CONTINUE"
	hint.TextColor3 = Color3.fromRGB(125, 138, 165)
	hint.Font = Enum.Font.GothamMedium
	hint.TextSize = 12
	hint.TextXAlignment = Enum.TextXAlignment.Right
	hint.Parent = dialogue

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

	task.wait(0.5)
	tween(dialogue, 0.5, {BackgroundTransparency = 1})
	tween(name, 0.35, {TextTransparency = 1})
	tween(text, 0.35, {TextTransparency = 1})
	tween(hint, 0.35, {TextTransparency = 1})
	task.wait(0.15)
	introGui:Destroy()

	camera.CameraType = Enum.CameraType.Custom
	local character = player.Character or player.CharacterAdded:Wait()
	local humanoid = character:WaitForChild("Humanoid")
	camera.CameraSubject = humanoid

	createHud()
	print("[WORLDSHIFT] Opening complete")
end

local function main()
	destroyOldUi()
	local introGui, fade = createIntro()
	runDialogue(introGui, fade)
	print("[WORLDSHIFT] Client ready for", player.Name)
end

main()
