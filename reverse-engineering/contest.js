var contest = $("#contest");
	if(window.contestId == null)
		contest.find("> .tab_container > .current").css("display","none");
	else
		contest.find("> .tab_container > .current").css("display","flex");
	contest.tabs = {};
	contest.tabIndex = -1;
	contest.find("> .tab_container > .current").text(m["CONTEST.CURRENT"]);
	contest.find("> .tab_container > .list").text(m["CONTEST.LIST"]);
	contest.find("> .tab_container > .finished").text(m["CONTEST.RECENTLY_FINISHED"]);
	var addTabClickHandler = function(tab,i)
	{
		$(tab).click(function() { contest.changeTab(i); });
	}
	var tabs = contest.find("> .tab_container > a");
	for(var i = 0;i < tabs.length;i++)
		addTabClickHandler(tabs[i],i);
	contest.changeTab = function(tabIndex)
	{
		if(contest.tabIndex == tabIndex)
			return;
		contest.tabIndex = tabIndex;
		contest.find("> .tab_container > a").removeClass("active");
		contest.find("> .tab_container > a:nth-child(" + (contest.tabIndex + 1) + ")").addClass("active");
		var tab = contest.tabs[contest.tabIndex];
		if(tab == null)
		{
			tab = $("<div class='body hidden-scrollbar tab" + tabIndex + "'></div>");
			contest.tabs[contest.tabIndex] = tab;
			contest.loadData(tab,tabIndex);
		}
		var tabContent = contest.find("> .tab_content");
		tabContent.empty();
		tabContent.append(tab);
	}
	contest.addTournament = function(tab,tournament,state)
	{
		// state: 1, 2: match/not match with fb tournament, 3: finished, 4: pending
		//var id = tournament.getID();
		//var contextId = tournament.getContextID();
		var endTime = tournament.getEndTime();
		var title = tournament.getTitle();
		var payload = tournament.getPayload();
		try
		{
			payload = JSON.parse(payload);
		}
		catch(ex)
		{
			payload = null;
		}
		var avatarUrl = payload == null ? null : payload.photo;
		if(avatarUrl == null || avatarUrl == '')
			avatarUrl = "images/contest.png";
		var joinable = state != 3 && state != 4 && (window.tournament == null || tournament.getID() != window.tournament.getID());
		var action = joinable ? "join(\"" + tournament.getID() + "\",\"" + window.escapeHtml(title) + "\")" :
			(state == 3 || state == 4 ? "view(\"" + tournament.getServerID() + "\",\"" + window.escapeHtml(title) + "\")" : null);
		html =
			(action != null
			 ? "<a href='javascript:void(0)' onclick='contest." + action + "' class='entry contest" + (state == 1 ? " joined" : "") + "'>"
			 : "<a class='entry contest'>") +
			"	" + window.createUrlImageHtml(avatarUrl,"class='avatar'") +
			"	<div class='attr-name'>" + window.escapeHtml(title) + "</div>" +
			"	<div class='attr-endTime'>" + (state == 4 ? "Start " : "End ") + (moment(endTime * 1000).fromNow()) + "</div>" +
			(joinable ? "	<label>⎆</label>" : "") +
			"</a>";
		tab.append(html);
		window.downloadAllUrlImage();
	}
	contest.addReg = function(tab,playerId,rank,online,avatarUrl,fullName,score,scoreDesc,prizes)
	{
		var prizeHtml = '';
		for(var i in prizes)
		{
			var prize = prizes[i];
			var type = prize.type.toLowerCase();
			if(prize.itemCode != null && prize.itemCode != '')
			{
				var url = cdnHost + "/cfgii/" + type +
					"/" + prize.itemCode.toLowerCase() + ".png";
				prizeHtml += window.createUrlImageHtml(url);
			}
			else
				prizeHtml += '<div class="item ' + type + '">' + formatMoney(prize.value + '') + '</div>';
		}
		if(avatarUrl == null || avatarUrl == '')
			avatarUrl = "images/stranger.png";
		var html =
			"<a href='javascript:void(0)' onclick='showGameProfile(" + playerId + ")' class='entry reg" +
			(online ? " online" : "") + (playerId == window.currentPlayerId ? " it-me" : "") + "'>" +
			"	<div class='rank'>" + rank + "</div>" +
			"	" + window.createUrlImageHtml(avatarUrl,"class='avatar'") +
			"	<div class='attrs'>" +
			"		<div class='attr name'>" + escapeHtml(fullName) + "</div>" +
			(score == null ? "" : "		<div class='attr score'>" + formatCurrency(score) + "</div>") +
			"	</div>" +
			(prizeHtml == '' ? "" : "	<div class='prize'>" + prizeHtml + "</div>") +
			"</a>";
		tab.append(html);
		window.downloadAllUrlImage();
	}
	contest.showGuide = function()
	{
		try
		{
			var payload = JSON.parse(tournament.getPayload());
			var guideUrl = payload.guide;
			if(guideUrl == null)
				return;
			var replacement = {
				id: window.contestId,
				type: window.contestType.toLowerCase(),
				locale: window.locale
			}
			for(var key in replacement)
				guideUrl = guideUrl.split("$" + key + "$").join(replacement[key]);
			$.ajax({
				type:"Get",
				url:guideUrl,
				success:function(data)
				{
					$.msgBox({
						title:m['CONTEST.GUIDE'],
						type:"dialog",
						closeOnClick:true,
						htmlContent:'<div class="contest-guide-content">' + data + '</div>'
					});
				}
			});
		}
		catch(ex)
		{
		}
	}
	var ServerContest = function(id,contextId,endTime,name,desc,serverId)
	{
		this.getID = function() { return id; };
		this.getServerID = function() { return serverId; };
		this.getContextID = function() { return contextId; };
		this.getEndTime = function() { return endTime; };
		this.getTitle = function() { return name; };
		this.getPayload = function() { return desc; };
	}
	var parseServerContest = function(res)
	{
		var serverContests = [];
		var count = res.readByte();
		for (var i = 0;i < count;i++)
		{
			var id = res.readLong();
			var code = res.readAscii().split('|');
			var endTime = res.readLong();
			var name = res.readString();
			var desc = res.readString();
			serverContests.push(new ServerContest(code[0],code.length > 1 ? code[1] : null,Math.round(endTime / 1000),name,desc,id));
		}
		return serverContests;
	}
	contest.addResponseReg = function(tab,res,prizes)
	{
		var playerId = res.readLong();
		var playerName = res.readString();
		var avatar = res.readLongAscii();
		var avatarId = res.readShort();
		var rank = res.readShort();
		var score = res.readLong();
		var scoreDesc = res.readString();
		var online = res.readByte() == 1;
		var matchPrizes = [];
		if(prizes != null)
		{
			for (var j = 0;j < prizes.length;j++)
			{
				var prize = prizes[j];
				if(rank == prize.position)
					matchPrizes = matchPrizes.concat(prize.items);
			}
			if(playerId == currentPlayerId)
			{
				var playerName = currentPlayerFullName;
				var avatar = currentPlayerAvatarUrl;
				online = true;
			}
		}
		contest.addReg(
			tab,playerId,rank,online,
			determineAvatar(avatar,avatarId),
			playerName,score,scoreDesc,matchPrizes);
	}
	var fillReg = function(tab,res)
	{
		var prizes = [];
		var prizeCount = res.readByte();
		for (var i = 0;i < prizeCount;i++)
		{
			var position = res.readInt();
			var count = res.readByte();
			var items = [];
			for (var j = 0;j < count;j++)
			{
				var type = res.readAscii();
				var itemCode = res.readAscii();
				var value = res.readLong();
				items.push({ type: type, itemCode: itemCode, value: value });
			}
			prizes.push({ position: position, items: items });
		}
		var regCount = res.readByte();
		for (var i = 0;i < regCount;i++)
			contest.addResponseReg(tab,res,prizes);
		for (var i = 0;i < prizeCount;i++)
		{
			var prize = prizes[i];
			if(prize.position > regCount)
				contest.addReg(tab,0,prize.position,false,null,"",null,"",prize.items);
		}
		return regCount;
	}
	contest.loadData = function(tab,tabIndex)
	{
		if(tabIndex == 1)
		{
			FBInstant.tournament.getTournamentsAsync().then(tournaments =>
			{
				var req = new OutboundMessage("CONTEST.LIST");
				connection.send(req,function(res,success)
				{
					var serverContests, serverPendingContests;
					if(success)
					{
						serverContests = parseServerContest(res);
						serverPendingContests = parseServerContest(res);
					}
					else
					{
						serverContests = [];
						serverPendingContests = [];
					}
					for(var i in tournaments)
					{
						for(var j in serverContests)
						{
							if(tournaments[i].getID() == serverContests[j].getID())
							{
								contest.addTournament(tab,serverContests[j],1);
								break;
							}
						}
					}
					for(var i in serverContests)
					{
						var serverContest = serverContests[i];
						var matched = false;
						for(var j in tournaments)
						{
							if(tournaments[j].getID() == serverContest.getID())
							{
								matched = true;
								break;
							}
						}
						if(!matched)
							contest.addTournament(tab,serverContest,2);
					}
					for(var i in serverPendingContests)
						contest.addTournament(tab,serverPendingContests[i],4);
					return success;
				});
			});
		}
		else if(tabIndex == 2)
		{
			var req = new OutboundMessage("CONTEST.LIST_FINISHED");
			connection.send(req,function(res,success)
			{
				var serverContests;
				if(success)
					serverContests = parseServerContest(res);
				else
					serverContests = [];
				for(var i in serverContests)
					contest.addTournament(tab,serverContests[i],3);
				return success;
			});
		}
		else if(window.tournament != null)
		{
			var req = new OutboundMessage("CONTEST.FETCH_CURRENT");
			req.writeByte(1);
			connection.send(req,function(res,success)
			{
				if (!success)
					return success;
				var regCount = fillReg(tab,res);
				var myPosition = res.readShort();
				var myPoint = res.readLong();
				var myPointDesc = res.readString();
				var contestName = res.readString();
				var contestPayload = res.readString();
				window.tournament.getTitle = function()
				{
					return contestName;
				}
				window.tournament.getPayload = function()
				{
					return contestPayload;
				}
				var hasPrevData = res.readByte();
				if(myPosition > regCount || hasPrevData != 0)
				{
					tab.append("<hr />");
					if(hasPrevData != 0)
						contest.addResponseReg(tab,res);
					if(myPosition > regCount)
						contest.addReg(tab,currentPlayerId,myPosition,true,
							currentPlayerAvatarUrl,currentPlayerFullName,myPoint,myPointDesc,[]);
				}
				var isInternal = res.readByte() == 1;
				var id = window.tournament.getID();
				var contextId = window.tournament.getContextID();
				var endTime = window.tournament.getEndTime();
				var title = window.tournament.getTitle();
				var payload = window.tournament.getPayload();
				try
				{
					payload = JSON.parse(payload);
				}
				catch(ex)
				{
					payload = null;
				}
				var avatarUrl = payload == null ? null : payload.photo;
				if(avatarUrl == null || avatarUrl == '')
					avatarUrl = "images/contest.png";
				var guideUrl = payload == null ? null : payload.guide;
				var html =
					"<div class='entry contest'>" +
					"	" + window.createUrlImageHtml(avatarUrl,"class='avatar'") +
					"	<div class='attr-name'>" + window.escapeHtml(title) + "</div>" +
					"	<div class='attr-endTime'>" +
					"		<img src='images/end_time_icon.png' />End " + (moment(endTime * 1000).fromNow()) +
					"	</div>" +
					"	<div class='button-panel'>" +
					"		<a href='javascript:void(0)' onclick='contest.showGuide()'>ⓘ</a>" +
					"		<a href='javascript:void(0)' onclick='" + (isInternal ? "contest.play" : "place.quickPlay") + "()'>▶</a>"
					"	</div>" +
					"</div>";
				tab.prepend(html);
				window.updateContestName();
				window.downloadAllUrlImage();
				return success;
			});
		}
	}
	contest.play = function()
	{
		var req = new OutboundMessage("CONTEST.ENTER_MATCH");
		connection.send(req,function(res,success)
		{
			if (!success)
				return success;
			var duration = res.readShort() * 1000;
			window.matchMaker.show(duration,function()
			{

			},function()
			{
				connection.send(new OutboundMessage("CONTEST.EXIT_MATCH"));
			});
			return success;
		});
	}
	contest.view = function(id,title)
	{
		var req = new OutboundMessage("CONTEST.FETCH");
		req.writeLong(id)
		req.writeByte(1);
		connection.send(req,function(res,success)
		{
			if (!success)
				return success;
			var tab = $("<div class='body hidden-scrollbar'></div>");
			var regCount = fillReg(tab,res);
			var myPosition = res.readShort();
			var myPoint = res.readLong();
			var myPointDesc = res.readString();
			if(myPosition > regCount)
			{
				tab.append("<hr />");
				if(res.readByte() != 0)
					contest.addResponseReg(tab,res);
				contest.addReg(tab,currentPlayerId,myPosition,true,
					currentPlayerAvatarUrl,currentPlayerFullName,myPoint,myPointDesc,[]);
			}
			var content = $("<div class='tab_content'></div>");
			content.append(tab);
			var root = $("<div id='contest'></div>");
			root.append(content);
			$.msgBox({
				title:title,
				type:"dialog",
				closeOnClick:true,
				htmlContent:root
			});
			return success;
		});
	}
	contest.join = function(id,title)
	{
		FBInstant.tournament.joinAsync(id).then(function()
		{
			FBInstant.getTournamentAsync().then((tournament) =>
			{
				window.tournament = tournament;
				window.tournament.getTitle = function()
				{
					return title;
				}
				var code = window.tournament.getID() + '';
				console.log("Entering contest " + code);
				var req = new OutboundMessage("CONTEST.ENTER");
				req.writeAscii(code);
				connection.send(req,function(res,success)
				{
					if(success)
					{
						window.contestId = res.readLong();
						window.contestType = res.readAscii();
						if(window.contestId == 0)
						{
							console.log("Contest " + code + " not found");
							window.contestId = null;
							window.updateContestName();
						}
						else
						{
							console.log("Entered contest " + contestId);
							place.hidePopup(() =>
							{
								window.updateContestName();
								breadscrumb.openContest();
							});
						}
					}
					else
					{
						console.log("Contest " + code + " not found");
						window.updateContestName();
					}
					return success;
				});
			}).catch((tournament) => {
				console.log('Not in a tournament');
			});
		}).catch(function(error) { log(error,true); });
	}
	if(window.contestId == null)
		contest.changeTab(1);
	else
		contest.changeTab(0);