set_world_size(6)



WORLD_SIZE=6



DIRECTION = [[0,1,North],[0,-1,South],[-1,0,West],[1,0,East]]
#DIRECTION2 = [North,South,West,East]


def my_move(dir,x,y):
 
 global DIRECTION

 if can_move(dir) == False:
  return -1,-1,None
 move(dir)
 
 if dir == North:
  #print("North")
  return x,y+1,DIRECTION[0]
 if dir == South:
  #print("South")
  return x,y-1,DIRECTION[1]
 if dir == West:
  #print("West")
  return x-1,y,DIRECTION[2] 
 if dir == East:
  #print("East")
  return x+1,y,DIRECTION[3] 
  




def eat_apple(body,x,y):
 body.insert(0,[x,y])
 return 

def snake_move(body,x,y):
 body.insert(0,[x,y])
 body.pop()
 return 
 
def nextStep(x,y):
 
 
 #print(x,y)
 if x == 0 and y == 0:
  return my_move(North,x,y)
   
 if x == 0 and y == WORLD_SIZE - 1 :
  return my_move(East,x,y)
  
 if x == WORLD_SIZE - 1  and y == WORLD_SIZE - 1 :
  return my_move(South,x,y)
 if x == 0:
  return my_move(North,x,y)
  
 
 if y == 0:
  return my_move(West,x,y)
  
  
 if y % 2 == 1:
  if x != WORLD_SIZE -1:
   return my_move(East,x,y)
  else:
   return my_move(South,x,y)
 else:
  if x != 1:
   return my_move(West,x,y)
  else:
   return my_move(South,x,y)
    

def get_option_dirs(x,y,nx,ny,next_dir):
    global DIRECTION
    ans = []
    for i in range(4):
        if x + DIRECTION[i][0] == nx and y + DIRECTION[i][1] == ny:
            continue 
        if DIRECTION[i] == next_dir:
            continue
        ans.append(DIRECTION[i]) 
    return ans

def init_map():
    map = []
    for i in range(WORLD_SIZE):
        map.append([])
        for j in range(WORLD_SIZE):
            map[i].append({
                "next":None,
                "optional":[],
                "id":0
            })
    
    x = 0
    y = 0
    i - 1
    while i < WORLD_SIZE*WORLD_SIZE:
        
        
        nx,ny,dir = nextStep(x,y)
        map[x][y]["id"] = i
        map[x][y]["next"] = dir 
        map[x][y]["optional"] = get_option_dirs(x,y,nx,ny,dir)
        i += 1
    
    return map 


def apple_distance(position_id,apple_id):
    if apple_id > position_id:
        return apple_id - position_id
    
    return apple_id + WORLD_SIZE*WORLD_SIZE - position_id


def find_position(x,y,snake):
    for i in range(len(snake)):
        if snake[i][0] == x and snake[i][1] == y:
            return len(snake)-i-1
    return -1
def has_safe_route(x,y,snake,map):
    l = len(snake)
    i = 0
    
    while i < l:
        pos = find_position(x,y,snake)
        if pos == -1 or pos <= i:
            nx = x + map[x][y]["next"][0]
            ny = y + map[x][y]["next"][1]
            i += 1
        else:
            return False 
    return True
    
def plan(x,y,snake,apple_x,apple_y,map):

    dis = apple_distance(map[x][y]["id"],map[apple_x][apple_y]["id"])
    for dir in map[x][y]["optional"]:
        nx = x + dir[0]
        ny = y + dir[1]
        dis2 = apple_distance(map[nx][ny]["id"],map[apple_x][apple_y]["id"])
        if dis2 < dis and has_safe_route(nx,ny,snake,map):
            move(dir[2])
            return [nx,ny]
    
    nx = x + map[x][y]["next"][0]
    ny = y + map[x][y]["next"][1]
    move(map[x][y]["next"][2])
    return [nx,ny]

map = init_map()

while True:
    x = get_pos_x()
    y = get_pos_y()
    change_hat(Hats.Brown_Hat)
    change_hat(Hats.Dinosaur_Hat)
    snake = [[x,y]]
    apple_x,apple_y = measure()
    while True:
  
        if len(snake) == WORLD_SIZE*WORLD_SIZE:
            break
        nx,ny = plan(x,y)
        #print(ans)
        x = nx 
        y = ny
        if x == apple_x and y == apple_y:
            eat_apple(snake,x,y)
        else:
            snake_move(snake,x,y)
  