"""Three faction tanks. Editable yaw/pitch hierarchy and +Z muzzle marker are the firing contract."""
import bpy
from generate import reset, palette, block, cylinder, mesh, join_group, label, export, xyz


def parent(child, target):
    transform = child.matrix_world.copy()
    child.parent = target
    child.matrix_world = transform


def armor(name, y, width, length, height, top_inset, mat, z=0):
    # Sloped glacis, chamfered shoulders, and a narrow roof give readable armor silhouettes.
    a, b, c = width / 2, length / 2, top_inset
    vertices = [(-a,y,z-b),(a,y,z-b),(a,y,z+b),(-a,y,z+b),
                (-a+c,y+height,z-b+c),(a-c,y+height,z-b+c),
                (a-c,y+height,z+b-c),(-a+c,y+height,z+b-c)]
    return mesh(name, vertices, [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)], mat)


def tank(kind):
    reset('Faction / ' + kind.title() + ' tank')
    m = palette()
    size = {'light':(3.5,4.4,0.95,1.85,2.5),'medium':(4.3,5.4,1.15,2.35,3.2),'heavy':(5.1,6.1,1.35,2.85,3.7)}
    width, length, deck, turret_width, barrel_length = size[kind]
    track_x = width / 2 - 0.42
    for side, sign in [('Left',-1),('Right',1)]:
        x = track_x * sign
        parts = [block(side+' track belt',(x,.58,0),(.88,1.05,length),m['rubber'],.23)]
        count = {'light':5,'medium':6,'heavy':7}[kind]
        for i in range(count):
            z = -length/2+.52+i*(length-1.04)/(count-1)
            parts.append(cylinder('Road wheel',(x+sign*.44,.57,z),.35,.1,m['steel'],'x',12))
            parts.append(cylinder('Wheel hub',(x+sign*.5,.57,z),.13,.04,m['ivory'],'x',10))
        for i in range(int(length/.26)):
            z = -length/2+.13+i*.26
            parts.append(block('Track shoe',(x,.09,z),(.93,.12,.13),m['steel'],.025))
            parts.append(block('Upper track shoe',(x,1.09,z),(.93,.1,.13),m['steel'],.025))
        parts.append(block('Armored fender',(x,1.18,0),(1.03,.23,length+.1),m['ivory'],.09))
        parts.append(block('Faction stripe',(x,1.305,-length*.22),(1.05,.035,.55),m['orange'],.01))
        if kind == 'heavy':
            for i in range(4):
                parts.append(block('Segmented side skirt',(x+sign*.48,.99,-2.1+i*1.4),(.15,.65,1.15),m['light'],.07))
        join_group(side+'TrackAssembly',parts)
    hull = [armor('Sloped hull',.75,width-1.05,length-.25,deck,.4,m['ivory']),
            block('Engine deck',(0,deck+.79,-length*.29),(width-1.4,.16,1.1),m['steel'],.06)]
    for i in range(5):
        hull.append(block('Cooling grille',(0,deck+.89,-length*.29-.4+i*.2),(width-1.65,.04,.065),m['dark'],.01))
    for sign in [-1,1]:
        hull.append(block('Headlamp',(sign*(width/2-.9),1.32,length/2-.14),(.35,.23,.11),m['lamp'],.04))
        hull.append(cylinder('Rear exhaust',(sign*(width/2-.85),1.22,-length/2+.03),.19,.3,m['dark'],'z',10))
        hull.append(block('Stowage locker',(sign*(width/2-.9),deck+.68,-length*.32),(.4,.45,.8),m['light'],.06))
    join_group('Hull',hull)
    base_y = deck+.82
    turret_height = {'light':.57,'medium':.8,'heavy':.9}[kind]
    cylinder('Turret ring',(0,base_y-.03,0),turret_width*.43,.18,m['dark'],vertices=24)
    parts = [armor('Turret armor',base_y,turret_width,turret_width*1.14,turret_height,.27,m['light']),
             block('Turret rear bustle',(0,base_y+.3,-turret_width*.48),(turret_width*.8,.5,.5),m['ivory'],.13),
             cylinder('Commander hatch',(-turret_width*.2,base_y+turret_height+.05,-.2),.35,.12,m['steel'],vertices=16),
             block('Periscope',(.35,base_y+turret_height+.11,.03),(.23,.18,.3),m['glass'],.025),
             block('Turret faction panel',(0,base_y+turret_height+.02,-turret_width*.26),(.38,.035,.6),m['orange'],.01)]
    if kind == 'heavy':
        for sign in [-1,1]:
            parts.append(block('Cheek armor',(sign*turret_width*.42,base_y+.43,.36),(.47,.55,1.2),m['ivory'],.16))
    parts.append(cylinder('Radio antenna',(-turret_width*.34,base_y+turret_height+.51,-.55),.026,.95,m['dark'],vertices=6))
    parts.append(label({'light':'L-01','medium':'M-01','heavy':'H-01'}[kind],(.12,base_y+turret_height+.028,.1),.24,m['dark']))
    pivot = (0,base_y+.23,0)
    turret = join_group('TurretYaw',parts,pivot)
    gun_y = base_y+.32
    gun_z = turret_width*.48
    radius = {'light':.105,'medium':.15,'heavy':.2}[kind]
    gun = [block('Gun mantlet',(0,gun_y,gun_z-.1),(.64,.47,.52),m['steel'],.12),
           cylinder('Cannon barrel',(0,gun_y,gun_z+barrel_length/2),radius,barrel_length,m['steel'],'z',12),
           cylinder('Barrel sleeve',(0,gun_y,gun_z+.4),radius*1.45,.6,m['ivory'],'z',12),
           block('Muzzle brake',(0,gun_y,gun_z+barrel_length-.05),(radius*3.2,radius*2.8,.42),m['dark'],.055)]
    pitch = join_group('GunPitch',gun,(0,gun_y,gun_z))
    parent(pitch,turret)
    muzzle = bpy.data.objects.new('Muzzle',None)
    bpy.context.collection.objects.link(muzzle)
    muzzle.location = xyz((0,gun_y,gun_z+barrel_length+.18))
    muzzle.empty_display_type = 'ARROWS'
    muzzle.empty_display_size = .25
    bpy.context.view_layer.update()
    parent(muzzle,pitch)
    export('tank-'+kind)
