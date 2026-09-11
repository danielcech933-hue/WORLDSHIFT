local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera
local Dialogue = require(ReplicatedStorage.Shared.IntroDialogue)
local SelectWorld = ReplicatedStorage:WaitForChild("Remotes"):WaitForChild("SelectStartingWorld")

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

local function destroyOldUi()
	local playerGui = player:WaitForChild("PlayerGui")
	for _, name in {"WorldShiftHUD", "WorldShiftIntro", "WorldShiftWorldSelect"} do
		local old = playerGui:FindFirstChild(name)
		if old then old:Destroy() end
	end
end

local function createHud()
	local gui = createGui("WorldShiftHUD")

	local title = Instance.new("TextLabel")
	title.Size = UDim2.fromOffset(500, 48)
	title.Position = UDim2.fromOffset(28, 24)
	title.BackgroundTransparency = 1
	title.Text = "WORLDSHIFT"
	title.TextColor3 = Color3.fromRGB(245, 247, 255)
	title.TextSize = 30
	title.Font = Enum.Font.GothamBold
	title.TextXAlignment = Enum.TextXAlignment.Left
	title.Parent = gui

	local location = Instance.new("TextLabel")
	location.Size = UDim2.fromOffset(600, 30)
	location.Position = UDim2.fromOffset(30, 68)
	location.BackgroundTransparency = 1
	location.TextColor3 = Color3.fromRGB(205, 214, 235)
	location.TextSize = 16
	location.Font = Enum.Font.GothamMedium
	location.TextXAlignment = Enum.TextXAlignment.Left
	location.Text = string.upper((player:GetAttribute("Reality") or "Anime") .. " REALITY  •  " .. (player:GetAttribute("Location") or "Hoshikawa"))
	location.Parent = gui
end

local function createIntro()
	local gui = createGui("WorldShiftIntro")

	local fade = Instance.new("Frame")
	fade.Size = UDim2.fromScale(1, 1)
	fade.BackgroundColor3 = Color3.new(0, 0, 0)
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

	task.wait(1)
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
		if processed then return end
		if input.KeyCode == Enum.KeyCode.Space or input.UserInputType == Enum.UserInputType.MouseButton1 then continue = true end
	end)
	while not continue do task.wait() end
	connection:Disconnect()
	return gui
end

local function runDialogue(introGui: ScreenGui)
	local guide = workspace:WaitForChild("World"):WaitForChild("NPCs"):WaitForChild("Guide")
	local guideHead = guide:WaitForChild("Head")

	camera.CameraType = Enum.CameraType.Scriptable
	local target = guideHead.Position + Vector3.new(0, 0.4, 0)
	camera.CFrame = CFrame.lookAt(target + Vector3.new(8, 3.2, 10), target)

	introGui:Destroy()
	local gui = createGui("WorldShiftIntro")

	local dialogue = Instance.new("Frame")
	dialogue.Size = UDim2.fromScale(0.76, 0.205)
	dialogue.Position = UDim2.fromScale(0.5, 0.82)
	dialogue.AnchorPoint = Vector2.new(0.5, 0.5)
	dialogue.BackgroundColor3 = Color3.fromRGB(10, 13, 22)
	dialogue.BackgroundTransparency = 0.08
	dialogue.BorderSizePixel = 0
	dialogue.Parent = gui

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 14)
	corner.Parent = dialogue

	local stroke = Instance.new("UIStroke")
	stroke.Color = Color3.fromRGB(105, 120, 155)
	stroke.Transparency = 0.45
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
		text.Text = line
		if index < #Dialogue.Lines then waitAdvance() end
	end

	task.wait(0.4)
	gui:Destroy()
end

local function createWorldCard(parent: Instance, titleText: string, subtitleText: string, description: string, x: number, reality: string)
	local card = Instance.new("TextButton")
	card.Size = UDim2.fromOffset(330, 270)
	card.Position = UDim2.new(0.5, x, 0.55, 0)
	card.AnchorPoint = Vector2.new(0.5, 0.5)
	card.BackgroundColor3 = Color3.fromRGB(16, 20, 32)
	card.BackgroundTransparency = 0.04
	card.BorderSizePixel = 0
	card.Text = ""
	card.AutoButtonColor = false
	card.Parent = parent

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 18)
	corner.Parent = card

	local stroke = Instance.new("UIStroke")
	stroke.Color = reality == "Anime" and Color3.fromRGB(140, 170, 230) or Color3.fromRGB(210, 155, 95)
	stroke.Transparency = 0.25
	stroke.Thickness = 1.5
	stroke.Parent = card

	local title = Instance.new("TextLabel")
	title.Size = UDim2.new(1, -40, 0, 46)
	title.Position = UDim2.fromOffset(20, 22)
	title.BackgroundTransparency = 1
	title.Text = titleText
	title.TextColor3 = Color3.fromRGB(245, 247, 255)
	title.Font = Enum.Font.GothamBold
	title.TextSize = 27
	title.TextXAlignment = Enum.TextXAlignment.Left
	title.Parent = card

	local subtitle = Instance.new("TextLabel")
	subtitle.Size = UDim2.new(1, -40, 0, 28)
	subtitle.Position = UDim2.fromOffset(20, 68)
	subtitle.BackgroundTransparency = 1
	subtitle.Text = subtitleText
	subtitle.TextColor3 = Color3.fromRGB(185, 198, 225)
	subtitle.Font = Enum.Font.GothamMedium
	subtitle.TextSize = 14
	subtitle.TextXAlignment = Enum.TextXAlignment.Left
	subtitle.Parent = card

	local descriptionLabel = Instance.new("TextLabel")
	descriptionLabel.Size = UDim2.new(1, -40, 0, 88)
	descriptionLabel.Position = UDim2.fromOffset(20, 105)
	descriptionLabel.BackgroundTransparency = 1
	descriptionLabel.Text = description
	descriptionLabel.TextColor3 = Color3.fromRGB(205, 211, 226)
	descriptionLabel.Font = Enum.Font.Gotham
	descriptionLabel.TextSize = 15
	descriptionLabel.TextWrapped = true
	descriptionLabel.TextXAlignment = Enum.TextXAlignment.Left
	descriptionLabel.TextYAlignment = Enum.TextYAlignment.Top
	descriptionLabel.Parent = card

	local choose = Instance.new("TextLabel")
	choose.Size = UDim2.new(1, -40, 0, 32)
	choose.Position = UDim2.fromOffset(20, 220)
	choose.BackgroundTransparency = 1
	choose.Text = "ENTER WORLD  →"
	choose.TextColor3 = Color3.fromRGB(245, 247, 255)
	choose.Font = Enum.Font.GothamBold
	choose.TextSize = 14
	choose.TextXAlignment = Enum.TextXAlignment.Right
	choose.Parent = card

	card.MouseEnter:Connect(function()
		tween(card, 0.15, {BackgroundColor3 = Color3.fromRGB(28, 34, 52)})
	end)
	card.MouseLeave:Connect(function()
		tween(card, 0.15, {BackgroundColor3 = Color3.fromRGB(16, 20, 32)})
	end)

	return card
end

local function chooseStartingWorld()
	local gui = createGui("WorldShiftWorldSelect")

	local backdrop = Instance.new("Frame")
	backdrop.Size = UDim2.fromScale(1, 1)
	backdrop.BackgroundColor3 = Color3.fromRGB(4, 6, 12)
	backdrop.BackgroundTransparency = 0.04
	backdrop.BorderSizePixel = 0
	backdrop.Parent = gui

	local title = Instance.new("TextLabel")
	title.Size = UDim2.fromOffset(900, 60)
	title.Position = UDim2.fromScale(0.5, 0.14)
	title.AnchorPoint = Vector2.new(0.5, 0.5)
	title.BackgroundTransparency = 1
	title.Text = "CHOOSE YOUR FIRST WORLD"
	title.TextColor3 = Color3.fromRGB(245, 247, 255)
	title.Font = Enum.Font.GothamBold
	title.TextSize = 34
	title.Parent = backdrop

	local subtitle = Instance.new("TextLabel")
	subtitle.Size = UDim2.fromOffset(900, 40)
	subtitle.Position = UDim2.fromScale(0.5, 0.21)
	subtitle.AnchorPoint = Vector2.new(0.5, 0.5)
	subtitle.BackgroundTransparency = 1
	subtitle.Text = "Your first choice shapes the world where your journey begins."
	subtitle.TextColor3 = Color3.fromRGB(165, 175, 198)
	subtitle.Font = Enum.Font.Gotham
	subtitle.TextSize = 16
	subtitle.Parent = backdrop

	local anime = createWorldCard(backdrop, "ANIME REALITY", "HOSHIKAWA", "A living coastal world of villages, shrines, forests, combat, crafting and stories.", -180, "Anime")
	local movie = createWorldCard(backdrop, "MOVIE REALITY", "METROVALE", "A cinematic modern city where every life can become a different kind of story.", 180, "Movie")

	local chosen = false
	local function select(reality: string)
		if chosen then return end
		chosen = true
		SelectWorld:FireServer(reality)
		for _, child in ipairs(backdrop:GetChildren()) do
			if child:IsA("GuiObject") then
				tween(child, 0.35, {BackgroundTransparency = 1})
			end
		end
		task.wait(0.4)
		gui:Destroy()
		createHud()
	end

	anime.MouseButton1Click:Connect(function() select("Anime") end)
	movie.MouseButton1Click:Connect(function() select("Movie") end)

	while not chosen do task.wait() end
end

local function finishOpening()
	camera.CameraType = Enum.CameraType.Custom
	local character = player.Character or player.CharacterAdded:Wait()
	local humanoid = character:WaitForChild("Humanoid")
	camera.CameraSubject = humanoid
end

local function main()
	destroyOldUi()
	local introGui = createIntro()
	runDialogue(introGui)
	chooseStartingWorld()
	finishOpening()
	print("[WORLDSHIFT] Opening complete — starting world chosen")
end

main()
