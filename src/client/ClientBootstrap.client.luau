local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local Lighting = game:GetService("Lighting")

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera
local Dialogue = require(ReplicatedStorage.Shared.IntroDialogue)

local function destroyOldUi()
	local playerGui = player:WaitForChild("PlayerGui")
	for _, name in { "WorldShiftHUD", "WorldShiftIntro", "WorldShiftChoice" } do
		local old = playerGui:FindFirstChild(name)
		if old then
			old:Destroy()
		end
	end
end

local function createGui(name: string, order: number): ScreenGui
	local gui = Instance.new("ScreenGui")
	gui.Name = name
	gui.ResetOnSpawn = false
	gui.IgnoreGuiInset = true
	gui.DisplayOrder = order
	gui.Parent = player:WaitForChild("PlayerGui")
	return gui
end

local function tween(instance: Instance, duration: number, properties: {[string]: any}, style: Enum.EasingStyle?, direction: Enum.EasingDirection?)
	local info = TweenInfo.new(duration, style or Enum.EasingStyle.Quint, direction or Enum.EasingDirection.Out)
	local animation = TweenService:Create(instance, info, properties)
	animation:Play()
	animation.Completed:Wait()
end

local function createHud()
	local gui = createGui("WorldShiftHUD", 50)

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
	location.Size = UDim2.fromOffset(600, 30)
	location.Position = UDim2.fromOffset(30, 68)
	location.BackgroundTransparency = 1
	location.Text = string.upper(tostring(player:GetAttribute("Reality") or "WORLD")) .. " REALITY  •  " .. string.upper(tostring(player:GetAttribute("Location") or "UNKNOWN"))
	location.TextColor3 = Color3.fromRGB(205, 214, 235)
	location.TextSize = 16
	location.Font = Enum.Font.GothamMedium
	location.TextXAlignment = Enum.TextXAlignment.Left
	location.TextTransparency = 1
	location.Parent = gui

	task.spawn(function()
		tween(title, 0.65, {TextTransparency = 0})
	end)
	task.wait(0.1)
	tween(location, 0.65, {TextTransparency = 0})
end

local function createIntro()
	local gui = createGui("WorldShiftIntro", 100)

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

	task.wait(0.8)
	tween(title, 1.0, {TextTransparency = 0})
	task.wait(0.2)
	tween(subtitle, 0.8, {TextTransparency = 0})
	task.wait(0.45)

	-- A subtle blink rather than a harsh flicker.
	for _ = 1, 2 do
		tween(fade, 0.18, {BackgroundTransparency = 0.76}, Enum.EasingStyle.Sine)
		tween(fade, 0.22, {BackgroundTransparency = 0.10}, Enum.EasingStyle.Sine)
	end

	tween(prompt, 0.65, {TextTransparency = 0})

	local continue = false
	local connection = UserInputService.InputBegan:Connect(function(input, processed)
		if processed then return end
		if input.KeyCode == Enum.KeyCode.Space or input.UserInputType == Enum.UserInputType.MouseButton1 then
			continue = true
		end
	end)

	while not continue do task.wait() end
	connection:Disconnect()

	return gui, fade
end

local function runDialogue(introGui: ScreenGui, fade: Frame)
	local world = workspace:WaitForChild("World")
	local guide = world:WaitForChild("NPCs"):WaitForChild("Guide")
	local guideHead = guide:WaitForChild("Head")

	camera.CameraType = Enum.CameraType.Scriptable
	local target = guideHead.Position + Vector3.new(0, 0.35, 0)
	camera.CFrame = CFrame.lookAt(target + Vector3.new(8, 3.2, 10), target)

	for _, child in ipairs(introGui:GetChildren()) do
		if child ~= fade then child:Destroy() end
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
	corner.CornerRadius = UDim.new(0, 16)
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
			if processed then return end
			if input.KeyCode == Enum.KeyCode.Space or input.UserInputType == Enum.UserInputType.MouseButton1 then advanced = true end
		end)
		while not advanced do task.wait() end
		connection:Disconnect()
	end

	for index, line in ipairs(Dialogue.Lines) do
		text.TextTransparency = 1
		text.Text = line
		tween(text, 0.22, {TextTransparency = 0}, Enum.EasingStyle.Quad)
		if index < #Dialogue.Lines then waitAdvance() end
	end

	task.wait(0.35)
	tween(dialogue, 0.45, {BackgroundTransparency = 1})
	tween(name, 0.3, {TextTransparency = 1})
	tween(text, 0.3, {TextTransparency = 1})
	tween(hint, 0.3, {TextTransparency = 1})
	task.wait(0.1)
end

local function makeCard(parent: Frame, titleText: string, subtitleText: string, description: string, symbol: string, accent: Color3, order: number, callback)
	local card = Instance.new("TextButton")
	card.Name = titleText:gsub(" ", "")
	card.LayoutOrder = order
	card.Size = UDim2.new(0.44, 0, 1, 0)
	card.BackgroundColor3 = Color3.fromRGB(16, 20, 32)
	card.BackgroundTransparency = 0.05
	card.AutoButtonColor = false
	card.Text = ""
	card.ClipsDescendants = true
	card.Parent = parent

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 20)
	corner.Parent = card

	local stroke = Instance.new("UIStroke")
	stroke.Color = accent
	stroke.Transparency = 0.62
	stroke.Thickness = 1
	stroke.Parent = card

	local scale = Instance.new("UIScale")
	scale.Scale = 0.96
	scale.Parent = card

	local glow = Instance.new("Frame")
	glow.Size = UDim2.new(1, 0, 0, 5)
	glow.BackgroundColor3 = accent
	glow.BackgroundTransparency = 0.1
	glow.BorderSizePixel = 0
	glow.Parent = card

	local icon = Instance.new("TextLabel")
	icon.Size = UDim2.fromOffset(90, 70)
	icon.Position = UDim2.fromOffset(28, 28)
	icon.BackgroundTransparency = 1
	icon.Text = symbol
	icon.TextColor3 = accent
	icon.TextSize = 48
	icon.Font = Enum.Font.GothamBold
	icon.TextXAlignment = Enum.TextXAlignment.Left
	icon.Parent = card

	local title = Instance.new("TextLabel")
	title.Size = UDim2.new(1, -56, 0, 42)
	title.Position = UDim2.fromOffset(28, 105)
	title.BackgroundTransparency = 1
	title.Text = titleText
	title.TextColor3 = Color3.fromRGB(246, 248, 255)
	title.TextSize = 28
	title.Font = Enum.Font.GothamBold
	title.TextXAlignment = Enum.TextXAlignment.Left
	title.Parent = card

	local subtitle = Instance.new("TextLabel")
	subtitle.Size = UDim2.new(1, -56, 0, 28)
	subtitle.Position = UDim2.fromOffset(28, 145)
	subtitle.BackgroundTransparency = 1
	subtitle.Text = subtitleText
	subtitle.TextColor3 = accent
	subtitle.TextSize = 15
	subtitle.Font = Enum.Font.GothamMedium
	subtitle.TextXAlignment = Enum.TextXAlignment.Left
	subtitle.Parent = card

	local desc = Instance.new("TextLabel")
	desc.Size = UDim2.new(1, -56, 0, 100)
	desc.Position = UDim2.fromOffset(28, 190)
	desc.BackgroundTransparency = 1
	desc.Text = description
	desc.TextColor3 = Color3.fromRGB(174, 183, 204)
	desc.TextSize = 16
	desc.Font = Enum.Font.Gotham
	desc.TextWrapped = true
	desc.TextXAlignment = Enum.TextXAlignment.Left
	desc.TextYAlignment = Enum.TextYAlignment.Top
	desc.Parent = card

	local choose = Instance.new("TextLabel")
	choose.Size = UDim2.new(1, -56, 0, 28)
	choose.Position = UDim2.new(0, 28, 1, -48)
	choose.BackgroundTransparency = 1
	choose.Text = "ENTER WORLD  →"
	choose.TextColor3 = Color3.fromRGB(225, 230, 242)
	choose.TextSize = 13
	choose.Font = Enum.Font.GothamBold
	choose.TextXAlignment = Enum.TextXAlignment.Left
	choose.Parent = card

	card.MouseEnter:Connect(function()
		TweenService:Create(scale, TweenInfo.new(0.25, Enum.EasingStyle.Quint), {Scale = 1.015}):Play()
		TweenService:Create(stroke, TweenInfo.new(0.25), {Transparency = 0.08, Thickness = 2}):Play()
	end)
	card.MouseLeave:Connect(function()
		TweenService:Create(scale, TweenInfo.new(0.25, Enum.EasingStyle.Quint), {Scale = 1}):Play()
		TweenService:Create(stroke, TweenInfo.new(0.25), {Transparency = 0.62, Thickness = 1}):Play()
	end)
	card.Activated:Connect(function() callback(card, scale, stroke, accent) end)

	return card
end

local function chooseStartingWorld()
	local gui = createGui("WorldShiftChoice", 200)

	local background = Instance.new("Frame")
	background.Size = UDim2.fromScale(1, 1)
	background.BackgroundColor3 = Color3.fromRGB(4, 6, 12)
	background.BackgroundTransparency = 1
	background.Parent = gui

	local blur = Lighting:FindFirstChild("WorldShiftChoiceBlur") or Instance.new("BlurEffect")
	blur.Name = "WorldShiftChoiceBlur"
	blur.Size = 0
	blur.Parent = Lighting
	TweenService:Create(blur, TweenInfo.new(0.8, Enum.EasingStyle.Quint), {Size = 18}):Play()

	local content = Instance.new("Frame")
	content.Size = UDim2.fromScale(0.82, 0.76)
	content.Position = UDim2.fromScale(0.5, 0.5)
	content.AnchorPoint = Vector2.new(0.5, 0.5)
	content.BackgroundTransparency = 1
	content.Parent = gui

	local eyebrow = Instance.new("TextLabel")
	eyebrow.Size = UDim2.new(1, 0, 0, 28)
	eyebrow.Position = UDim2.fromOffset(0, 0)
	eyebrow.BackgroundTransparency = 1
	eyebrow.Text = "WORLDSHIFT  /  FIRST DECISION"
	eyebrow.TextColor3 = Color3.fromRGB(125, 138, 165)
	eyebrow.Font = Enum.Font.GothamMedium
	eyebrow.TextSize = 13
	eyebrow.TextXAlignment = Enum.TextXAlignment.Center
	eyebrow.Parent = content

	local heading = Instance.new("TextLabel")
	heading.Size = UDim2.new(1, 0, 0, 58)
	heading.Position = UDim2.fromOffset(0, 34)
	heading.BackgroundTransparency = 1
	heading.Text = "CHOOSE YOUR FIRST WORLD"
	heading.TextColor3 = Color3.fromRGB(247, 248, 255)
	heading.Font = Enum.Font.GothamBold
	heading.TextSize = 36
	heading.TextXAlignment = Enum.TextXAlignment.Center
	heading.Parent = content

	local sub = Instance.new("TextLabel")
	sub.Size = UDim2.new(1, 0, 0, 34)
	sub.Position = UDim2.fromOffset(0, 90)
	sub.BackgroundTransparency = 1
	sub.Text = "Your journey begins with a choice."
	sub.TextColor3 = Color3.fromRGB(164, 174, 197)
	sub.Font = Enum.Font.Gotham
	sub.TextSize = 16
	sub.TextXAlignment = Enum.TextXAlignment.Center
	sub.Parent = content

	local cards = Instance.new("Frame")
	cards.Size = UDim2.new(1, 0, 0, 330)
	cards.Position = UDim2.fromOffset(0, 140)
	cards.BackgroundTransparency = 1
	cards.Parent = content

	local layout = Instance.new("UIListLayout")
	layout.FillDirection = Enum.FillDirection.Horizontal
	layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
	layout.VerticalAlignment = Enum.VerticalAlignment.Center
	layout.Padding = UDim.new(0, 24)
	layout.Parent = cards

	local chosen = false
	local function selectWorld(reality: string, card: TextButton, scale: UIScale, stroke: UIStroke, accent: Color3)
		if chosen then return end
		chosen = true

		for _, child in ipairs(cards:GetChildren()) do
			if child:IsA("TextButton") and child ~= card then
				TweenService:Create(child, TweenInfo.new(0.35, Enum.EasingStyle.Quint), {BackgroundTransparency = 0.45}):Play()
				TweenService:Create(child:FindFirstChildOfClass("UIScale"), TweenInfo.new(0.35, Enum.EasingStyle.Quint), {Scale = 0.94}):Play()
			end
		end

		TweenService:Create(scale, TweenInfo.new(0.45, Enum.EasingStyle.Back), {Scale = 1.035}):Play()
		TweenService:Create(stroke, TweenInfo.new(0.25), {Transparency = 0, Thickness = 3}):Play()
		task.wait(0.28)

		local remotes = ReplicatedStorage:WaitForChild("Remotes")
		local remote = remotes:WaitForChild("SelectStartingWorld")
		remote:FireServer(reality)

		TweenService:Create(background, TweenInfo.new(0.65, Enum.EasingStyle.Quint), {BackgroundTransparency = 0}):Play()
		task.wait(0.7)

		if blur then blur:Destroy() end
		gui:Destroy()
		camera.CameraType = Enum.CameraType.Custom
		local character = player.Character or player.CharacterAdded:Wait()
		local humanoid = character:WaitForChild("Humanoid")
		camera.CameraSubject = humanoid
		createHud()
	end

	makeCard(cards, "ANIME REALITY", "HOSHIKAWA", "A coastal world of villages, shrines, forests, combat, crafting and stories waiting to become yours.", "✦", Color3.fromRGB(255, 150, 205), 1, function(card, scale, stroke, accent)
		selectWorld("Anime", card, scale, stroke, accent)
	end)

	makeCard(cards, "MOVIE REALITY", "METROVALE", "A cinematic modern world of studios, city life, ambition, careers and stories you can shape yourself.", "◈", Color3.fromRGB(130, 190, 255), 2, function(card, scale, stroke, accent)
		selectWorld("Movie", card, scale, stroke, accent)
	end)

	TweenService:Create(background, TweenInfo.new(0.8, Enum.EasingStyle.Quint), {BackgroundTransparency = 0.06}):Play()
	content.Position = UDim2.fromScale(0.5, 0.54)
	TweenService:Create(content, TweenInfo.new(0.75, Enum.EasingStyle.Quint, Enum.EasingDirection.Out), {Position = UDim2.fromScale(0.5, 0.5)}):Play()
end

local function main()
	destroyOldUi()
	local introGui, fade = createIntro()
	runDialogue(introGui, fade)
	introGui:Destroy()

	-- The choice happens in a neutral visual layer. The player never sees
	-- the prototype world layouts sitting next to each other.
	chooseStartingWorld()
	print("[WORLDSHIFT] Opening and first-world choice complete")
end

main()
